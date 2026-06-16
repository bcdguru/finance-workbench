import test from "node:test";
import assert from "node:assert/strict";

import {
  SkillRegistry,
  ProviderGateway,
  ArtifactStore,
  TranscriptProvider,
  InteractiveSession,
  SessionManager,
  runInteractiveTurn,
  InteractiveModeError,
  type SkillDefinition,
  type LlmMessage,
} from "../src/index.js";

const officeHours: SkillDefinition = {
  name: "demo-office-hours",
  version: "1",
  description: "",
  mode: "interactive",
  upstream: null,
  artifactKind: "thesis",
  verdictField: "verdict",
  verdictVocabulary: ["READY_TO_REVIEW", "NOT_READY"],
  artifactSchema: {
    type: "object",
    required: ["title", "verdict"],
    properties: { title: { type: "string" }, verdict: { type: "string", enum: ["READY_TO_REVIEW", "NOT_READY"] } },
  },
  prompt: "Ask one forcing question at a time; emit the thesis JSON only when done.",
};
const headless: SkillDefinition = { ...officeHours, name: "demo-headless", mode: "headless" };

function harness(transcript: Array<string | Record<string, unknown>>) {
  const registry = new SkillRegistry([officeHours, headless]);
  const gateway = new ProviderGateway([new TranscriptProvider({ id: "t", transcript })], { routes: { "*": { primary: { provider: "t", model: "m" } } } });
  const store = new ArtifactStore();
  return { registry, gateway, store, manager: new SessionManager(gateway, store) };
}

test("an interactive session asks one question per turn, then completes with a validated artifact", async () => {
  const { manager, store } = harness([
    "What exactly are we evaluating?",
    "Where does the durable value come from?",
    { title: "Midwest DC", verdict: "READY_TO_REVIEW" },
  ]);
  const session = manager.start(officeHours, "deal-1");

  const t1 = await session.send("We're considering a Midwest distribution center.");
  assert.equal(t1.status, "active");
  assert.equal(t1.question, "What exactly are we evaluating?");

  const t2 = await session.send("A single 400k sq ft DC.");
  assert.equal(t2.status, "active");
  assert.equal(t2.question, "Where does the durable value come from?");

  const t3 = await session.send("Outbound freight cost reduction.");
  assert.equal(t3.status, "complete");
  assert.equal(t3.artifact?.verdict, "READY_TO_REVIEW");
  assert.equal(session.status, "complete");
  assert.equal(store.list("deal-1").length, 1); // persisted

  await assert.rejects(() => session.send("more"), /already complete/);
});

test("runInteractiveTurn is stateless — the caller carries the history", async () => {
  const { registry, gateway, store } = harness(["First question?", { title: "x", verdict: "NOT_READY" }]);
  const skill = registry.get("demo-office-hours");

  let messages: LlmMessage[] = [{ role: "user", content: "kick off" }];
  const a = await runInteractiveTurn({ skill, gateway, store, parentObjectId: "d", messages });
  assert.equal(a.status, "active");
  assert.equal(a.question, "First question?");
  assert.equal(a.messages.length, 2); // user + assistant

  messages = [...a.messages, { role: "user", content: "my answer" }];
  const b = await runInteractiveTurn({ skill, gateway, store, parentObjectId: "d", messages });
  assert.equal(b.status, "complete");
  assert.equal(b.artifact?.verdict, "NOT_READY");
});

test("a headless skill is refused in interactive mode", async () => {
  const { gateway, store } = harness(["q"]);
  assert.throws(() => new InteractiveSession(headless, gateway, store, "d"), InteractiveModeError);
  await assert.rejects(
    () => runInteractiveTurn({ skill: headless, gateway, store, parentObjectId: "d", messages: [{ role: "user", content: "x" }] }),
    InteractiveModeError,
  );
});

test("a mid-conversation JSON that fails validation is treated as a question, not completion", async () => {
  const { manager } = harness([
    { title: "incomplete" }, // missing verdict -> not a valid artifact
    { title: "done", verdict: "READY_TO_REVIEW" },
  ]);
  const session = manager.start(officeHours, "deal-2");
  const t1 = await session.send("start");
  assert.equal(t1.status, "active"); // invalid object -> still asking
  const t2 = await session.send("answer");
  assert.equal(t2.status, "complete");
});
