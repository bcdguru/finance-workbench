import test from "node:test";
import assert from "node:assert/strict";

import skills from "../../../api/skills.ts";
import models from "../../../api/models.ts";
import run from "../../../api/run.ts";
import session from "../../../api/session.ts";

/**
 * Verifies the Vercel serverless handlers locally (the logic Vercel will run),
 * by invoking them with mock req/res. This exercises the same path the deployed
 * link uses: skills bundle import + compiled @fw/harness + the scripted chain.
 * Requires `npm run build:harness && npm run build:bundle` first (the
 * test:console script does both).
 */
function mockRes() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(s: number) { this.statusCode = s; return this; },
    json(d: unknown) { this.body = d; return this; },
  };
}

test("GET /api/skills returns the ordered chain", () => {
  const res = mockRes();
  skills({} as any, res as any);
  const data = res.body as any;
  assert.equal(res.statusCode, 200);
  assert.deepEqual(data.skills.map((s: any) => s.name), [
    "cfo-office-hours",
    "cfo-strategic-review",
    "cfo-forensic-audit",
  ]);
});

test("GET /api/models returns the scripted model options", () => {
  const res = mockRes();
  models({} as any, res as any);
  const data = res.body as any;
  assert.equal(data.models.length, 2);
  assert.deepEqual(data.models.map((m: any) => m.provider), ["model-a", "model-b"]);
});

test("POST /api/run produces a schema-valid chain (clean read)", async () => {
  const res = mockRes();
  await run({ body: { deal: "ERP re-platform", modelId: "model-a" } } as any, res as any);
  const data = res.body as any;
  assert.equal(res.statusCode, 200);
  assert.deepEqual(data.artifacts.map((a: any) => a.verdict), [
    "READY_TO_REVIEW",
    "GREEN",
    "PROCEED_WITH_VERIFICATIONS",
  ]);
  assert.equal(data.artifacts[0].body.title, "ERP re-platform");
  assert.equal(data.ledger.length, 3);
});

test("POST /api/run on the adversarial model returns harsher verdicts", async () => {
  const res = mockRes();
  await run({ body: { deal: "ERP re-platform", modelId: "model-b" } } as any, res as any);
  const data = res.body as any;
  assert.deepEqual(data.artifacts.map((a: any) => a.verdict), [
    "READY_TO_REVIEW",
    "ORANGE",
    "REWORK",
  ]);
});

test("POST /api/session advances a conversational turn and completes statelessly", async () => {
  // First turn: one user message -> a question.
  let res = mockRes();
  await session({ body: { deal: "ERP re-platform", messages: [{ role: "user", content: "weighing an ERP re-platform" }] } } as any, res as any);
  let data = res.body as any;
  assert.equal(res.statusCode, 200);
  assert.equal(data.status, "active");
  assert.ok(data.question);

  // Drive to completion, carrying the history back each turn (stateless).
  let guard = 0;
  while (data.status === "active" && guard++ < 10) {
    res = mockRes();
    await session({ body: { deal: "ERP re-platform", messages: [...data.messages, { role: "user", content: "answer" }] } } as any, res as any);
    data = res.body as any;
  }
  assert.equal(data.status, "complete");
  assert.equal(data.artifact.verdict, "READY_TO_REVIEW");
});
