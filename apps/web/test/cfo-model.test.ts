import test from "node:test";
import assert from "node:assert/strict";

import { verdictTone, verdictFor, summarize } from "../src/workbenches/cfo-model.ts";
import type { CfoDeal, CfoDealset } from "../src/cfo/types.ts";

function art(skill: string, verdict: string) {
  return { skill, artifactKind: skill, verdict, modelId: "claude-fable-5", createdAt: "2026-06-15T00:00:00Z", body: {} };
}
function deal(id: string, verdicts: { thesis: string; review?: string; audit?: string }): CfoDeal {
  const artifacts = [art("cfo-office-hours", verdicts.thesis)];
  if (verdicts.review) artifacts.push(art("cfo-strategic-review", verdicts.review));
  if (verdicts.audit) artifacts.push(art("cfo-forensic-audit", verdicts.audit));
  return { id, title: id, sponsor: "x", decisionType: "Capex", amount: 1, stage: artifacts[artifacts.length - 1]!.skill, status: "", artifacts };
}
const set = (deals: CfoDeal[]): CfoDealset => ({ generatedAt: "", source: "harness", tenant: "t", harshVerdictRate: 0, deals });

test("verdictTone maps verdicts to chip tones", () => {
  assert.equal(verdictTone("GREEN"), "good");
  assert.equal(verdictTone("PROCEED_WITH_VERIFICATIONS"), "caution");
  assert.equal(verdictTone("ORANGE"), "reframe");
  assert.equal(verdictTone("DO_NOT_MODEL"), "bad");
  assert.equal(verdictTone("NOT_READY"), "neutral");
});

test("verdictFor returns the verdict for a stage, or undefined", () => {
  const d = deal("d", { thesis: "READY_TO_REVIEW", review: "ORANGE" });
  assert.equal(verdictFor(d, "cfo-strategic-review"), "ORANGE");
  assert.equal(verdictFor(d, "cfo-forensic-audit"), undefined);
});

test("summarize counts pipeline outcomes and a healthy harsh-verdict rate", () => {
  const s = summarize(set([
    deal("d1", { thesis: "READY_TO_REVIEW", review: "GREEN", audit: "PROCEED" }),
    deal("d2", { thesis: "READY_TO_REVIEW", review: "ORANGE", audit: "REWORK" }),
    deal("d3", { thesis: "READY_TO_REVIEW", review: "GREEN", audit: "PROCEED_WITH_VERIFICATIONS" }),
  ]));
  assert.equal(s.total, 3);
  assert.equal(s.clearedToModel, 2); // d1 PROCEED + d3 PROCEED_WITH_VERIFICATIONS
  assert.equal(s.reframeOrRework, 1); // d2
  assert.equal(s.killedOrRejected, 0);
  // decisive = 6 artifacts (3 reviews + 3 audits), harsh = ORANGE + REWORK = 2 -> 33%
  assert.equal(Math.round(s.harshVerdictRate * 100), 33);
  assert.equal(s.harshRateHealthy, true);
});

test("summarize detects kills/rejections and an unhealthy (all-harsh) rate", () => {
  const s = summarize(set([
    deal("d1", { thesis: "READY_TO_REVIEW", review: "RED" }),
    deal("d2", { thesis: "READY_TO_REVIEW", review: "GREEN", audit: "DO_NOT_MODEL" }),
  ]));
  assert.equal(s.killedOrRejected, 2); // RED review + DO_NOT_MODEL audit
  // decisive = RED, GREEN, DO_NOT_MODEL -> 2 harsh of 3 = 67%, outside 25-50%
  assert.equal(s.harshRateHealthy, false);
});

test("a chain that only ever returns green is flagged unhealthy (the PRD invariant)", () => {
  const s = summarize(set([
    deal("d1", { thesis: "READY_TO_REVIEW", review: "GREEN", audit: "PROCEED" }),
    deal("d2", { thesis: "READY_TO_REVIEW", review: "GREEN", audit: "PROCEED" }),
  ]));
  assert.equal(s.harshVerdictRate, 0);
  assert.equal(s.harshRateHealthy, false); // 0% is below the 25% floor -> broken
});
