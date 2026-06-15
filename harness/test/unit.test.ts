import test from "node:test";
import assert from "node:assert/strict";

import {
  validate,
  sampleFromSchema,
  ProviderGateway,
  ArtifactStore,
  SkillRegistry,
  SkillRunner,
  ScriptedProvider,
  OpenAICompatibleProvider,
  SequencingError,
  VerdictError,
  ArtifactValidationError,
  type SkillDefinition,
} from "../src/index.js";

/* ------------------------------------------------------------------ */
/* JSON Schema validator                                              */
/* ------------------------------------------------------------------ */

const objSchema = {
  type: "object",
  required: ["name", "verdict", "items"],
  properties: {
    name: { type: "string" },
    verdict: { type: "string", enum: ["GREEN", "RED"] },
    count: { type: "integer" },
    items: { type: "array", items: { type: "object", required: ["k"], properties: { k: { type: "string" } } } },
  },
};

test("validate: a conformant object yields no errors", () => {
  const errors = validate({ name: "x", verdict: "GREEN", items: [{ k: "a" }] }, objSchema);
  assert.deepEqual(errors, []);
});

test("validate: missing required field is reported with a path", () => {
  const errors = validate({ name: "x", items: [] }, objSchema);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.path, "$.verdict");
});

test("validate: enum violation is reported", () => {
  const errors = validate({ name: "x", verdict: "ORANGE", items: [] }, objSchema);
  assert.ok(errors.some((e) => e.path === "$.verdict" && /not in enum/.test(e.message)));
});

test("validate: type mismatch is reported", () => {
  const errors = validate({ name: 5, verdict: "GREEN", items: [] }, objSchema);
  assert.ok(errors.some((e) => e.path === "$.name" && /expected type string/.test(e.message)));
});

test("validate: errors inside array items carry an indexed path", () => {
  const errors = validate({ name: "x", verdict: "GREEN", items: [{ k: "ok" }, { wrong: 1 }] }, objSchema);
  assert.ok(errors.some((e) => e.path === "$.items[1].k"));
});

test("validate: const is enforced", () => {
  assert.deepEqual(validate("v1", { const: "v1" }), []);
  assert.equal(validate("v2", { const: "v1" }).length, 1);
});

test("sampleFromSchema produces an instance that validates against the schema", () => {
  const sample = sampleFromSchema(objSchema);
  assert.deepEqual(validate(sample, objSchema), []);
  // enum -> first value
  assert.equal((sample as any).verdict, "GREEN");
});

/* ------------------------------------------------------------------ */
/* ProviderGateway — routing, fallback, metering                      */
/* ------------------------------------------------------------------ */

test("gateway routes to the default '*' route and meters the call", async () => {
  const gw = new ProviderGateway([new ScriptedProvider({ id: "p1" })], {
    tenant: "t1",
    routes: { "*": { primary: { provider: "p1", model: "m1" } } },
  });
  const res = await gw.complete("any-skill", { messages: [{ role: "user", content: "hi" }] });
  assert.equal(res.providerId, "p1");
  assert.equal(res.modelId, "m1");
  const ledger = gw.getLedger();
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0]!.tenant, "t1");
  assert.equal(ledger[0]!.skill, "any-skill");
});

test("gateway prefers a per-skill route over the default", async () => {
  const gw = new ProviderGateway([new ScriptedProvider({ id: "a" }), new ScriptedProvider({ id: "b" })], {
    routes: { "*": { primary: { provider: "a", model: "ma" } }, special: { primary: { provider: "b", model: "mb" } } },
  });
  assert.equal((await gw.complete("special", { messages: [] })).providerId, "b");
  assert.equal((await gw.complete("other", { messages: [] })).providerId, "a");
});

test("gateway falls back when the primary provider fails", async () => {
  const gw = new ProviderGateway(
    [new ScriptedProvider({ id: "broken", fail: true }), new ScriptedProvider({ id: "backup" })],
    { routes: { "*": { primary: { provider: "broken", model: "m" }, fallback: [{ provider: "backup", model: "m" }] } } },
  );
  assert.equal((await gw.complete("s", { messages: [] })).providerId, "backup");
});

test("gateway throws when every provider in the chain fails", async () => {
  const gw = new ProviderGateway([new ScriptedProvider({ id: "x", fail: true })], {
    routes: { "*": { primary: { provider: "x", model: "m" } } },
  });
  await assert.rejects(() => gw.complete("s", { messages: [] }), /All providers failed/);
});

test("gateway throws when no route resolves", async () => {
  const gw = new ProviderGateway([new ScriptedProvider({ id: "x" })], { routes: {} });
  await assert.rejects(() => gw.complete("s", { messages: [] }), /No route configured/);
});

/* ------------------------------------------------------------------ */
/* ArtifactStore                                                      */
/* ------------------------------------------------------------------ */

test("artifact store assigns ids, preserves lineage, and filters by parent", () => {
  const store = new ArtifactStore();
  const a = store.put({ parentObjectId: "deal-1", skill: "s", skillVersion: "1", artifactKind: "k", verdict: "GREEN", upstreamArtifactId: null, providerId: "p", modelId: "m", usage: { inputTokens: 1, outputTokens: 2 }, body: {} });
  assert.match(a.id, /^art_/);
  assert.ok(a.createdAt);
  store.put({ parentObjectId: "deal-2", skill: "s", skillVersion: "1", artifactKind: "k", verdict: "RED", upstreamArtifactId: a.id, providerId: "p", modelId: "m", usage: { inputTokens: 0, outputTokens: 0 }, body: {} });
  assert.equal(store.list().length, 2);
  assert.equal(store.list("deal-1").length, 1);
  assert.equal(store.get(a.id).verdict, "GREEN");
  assert.throws(() => store.get("art_missing"), /not found/);
});

/* ------------------------------------------------------------------ */
/* SkillRegistry                                                      */
/* ------------------------------------------------------------------ */

test("registry registers, gets, lists, and throws on unknown", () => {
  const skill = { name: "demo", version: "1", description: "", mode: "headless", upstream: null, artifactKind: "k", verdictField: "verdict", verdictVocabulary: ["A"], artifactSchema: {}, prompt: "" } as SkillDefinition;
  const reg = new SkillRegistry([skill]);
  assert.equal(reg.get("demo").name, "demo");
  assert.equal(reg.list().length, 1);
  assert.throws(() => reg.get("nope"), /not found/);
});

/* ------------------------------------------------------------------ */
/* ScriptedProvider                                                   */
/* ------------------------------------------------------------------ */

test("scripted provider returns the canned artifact for the routed skill", async () => {
  const p = new ScriptedProvider({ id: "s", script: { mySkill: { verdict: "RED" } } });
  const res = await p.complete({ messages: [], metadata: { skill: "mySkill" } }, "m");
  assert.deepEqual(res.structured, { verdict: "RED" });
});

test("scripted provider derives a schema-valid artifact when no script is given", async () => {
  const p = new ScriptedProvider({ id: "s" });
  const res = await p.complete({ messages: [], responseSchema: objSchema, metadata: { skill: "x" } }, "m");
  assert.deepEqual(validate(res.structured, objSchema), []);
});

/* ------------------------------------------------------------------ */
/* OpenAICompatibleProvider — wire format (mocked fetch)              */
/* ------------------------------------------------------------------ */

test("openai-compatible provider posts chat completions and parses the result", async () => {
  const calls: any[] = [];
  const fakeFetch = async (url: any, init: any) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"verdict":"GREEN"}' } }], usage: { prompt_tokens: 11, completion_tokens: 7 } }), { status: 200 });
  };
  const original = globalThis.fetch;
  (globalThis as any).fetch = fakeFetch;
  try {
    const p = new OpenAICompatibleProvider({ id: "openai", baseUrl: "https://api.example.com/v1" });
    const res = await p.complete({ system: "sys", messages: [{ role: "user", content: "go" }], responseSchema: objSchema }, "gpt-x");
    assert.equal(res.text, '{"verdict":"GREEN"}');
    assert.deepEqual(res.structured, { verdict: "GREEN" });
    assert.deepEqual(res.usage, { inputTokens: 11, outputTokens: 7 });
    assert.equal(calls[0].url, "https://api.example.com/v1/chat/completions");
    assert.equal(calls[0].body.messages[0].role, "system");
    assert.equal(calls[0].body.response_format.type, "json_schema");
  } finally {
    (globalThis as any).fetch = original;
  }
});

test("openai-compatible provider throws on a non-2xx response", async () => {
  const original = globalThis.fetch;
  (globalThis as any).fetch = async () => new Response("nope", { status: 500 });
  try {
    const p = new OpenAICompatibleProvider({ id: "openai", baseUrl: "https://x/v1" });
    await assert.rejects(() => p.complete({ messages: [] }, "m"), /HTTP 500/);
  } finally {
    (globalThis as any).fetch = original;
  }
});

/* ------------------------------------------------------------------ */
/* SkillRunner — sequencing, schema, verdict vocabulary               */
/* ------------------------------------------------------------------ */

function runnerWith(skill: SkillDefinition, script: Record<string, unknown>) {
  const registry = new SkillRegistry([skill]);
  const gateway = new ProviderGateway([new ScriptedProvider({ id: "p", script })], { routes: { "*": { primary: { provider: "p", model: "m" } } } });
  const store = new ArtifactStore();
  return { runner: new SkillRunner(registry, gateway, store), store };
}

const downstreamSkill: SkillDefinition = {
  name: "child", version: "1", description: "", mode: "headless", upstream: "parent",
  artifactKind: "k", verdictField: "verdict", verdictVocabulary: ["OK"],
  artifactSchema: { type: "object", required: ["verdict"], properties: { verdict: { type: "string", enum: ["OK", "BAD"] } } },
  prompt: "",
};

test("runner refuses a downstream skill when the upstream artifact is missing", async () => {
  const { runner } = runnerWith(downstreamSkill, { child: { verdict: "OK" } });
  await assert.rejects(() => runner.run("child", { parentObjectId: "d", userInput: "x" }), SequencingError);
});

test("runner raises ArtifactValidationError when the artifact misses required fields", async () => {
  const root: SkillDefinition = { ...downstreamSkill, name: "root", upstream: null };
  const { runner } = runnerWith(root, { root: {} }); // empty object, missing verdict
  await assert.rejects(() => runner.run("root", { parentObjectId: "d", userInput: "x" }), ArtifactValidationError);
});

test("runner raises VerdictError when the verdict is schema-valid but outside the vocabulary", async () => {
  // schema enum allows OK|BAD, but vocabulary only allows OK -> "BAD" must be rejected.
  const root: SkillDefinition = { ...downstreamSkill, name: "root2", upstream: null };
  const { runner } = runnerWith(root, { root2: { verdict: "BAD" } });
  await assert.rejects(() => runner.run("root2", { parentObjectId: "d", userInput: "x" }), VerdictError);
});

test("runner persists a valid artifact with full lineage", async () => {
  const root: SkillDefinition = { ...downstreamSkill, name: "root3", upstream: null };
  const { runner, store } = runnerWith(root, { root3: { verdict: "OK" } });
  const art = await runner.run("root3", { parentObjectId: "deal-9", userInput: "x" });
  assert.equal(art.verdict, "OK");
  assert.equal(art.providerId, "p");
  assert.equal(art.modelId, "m");
  assert.equal(store.list("deal-9").length, 1);
});
