import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { SkillRegistry } from "@fw/harness";
import { chainOrder, SCRIPTED_MODELS, scriptFor, scriptedProviderFor, runChain, skillSummaries } from "../lib/console-core.js";

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "skills");
const registry = SkillRegistry.loadFromDir(skillsDir);

test("chainOrder follows upstream links to order the CFO chain", () => {
  assert.deepEqual(chainOrder(registry), ["cfo-office-hours", "cfo-strategic-review", "cfo-forensic-audit"]);
});

test("two scripted models are offered (the LLM-routing demo)", () => {
  assert.deepEqual(SCRIPTED_MODELS.map((m) => m.provider), ["model-a", "model-b"]);
});

test("scriptFor injects the deal title and encodes clean vs adversarial verdicts", () => {
  const clean = scriptFor("clean", "My deal") as any;
  assert.equal(clean["cfo-office-hours"].title, "My deal");
  assert.equal(clean["cfo-strategic-review"].verdict, "GREEN");
  assert.equal(clean["cfo-forensic-audit"].verdict, "PROCEED_WITH_VERIFICATIONS");
  const harsh = scriptFor("harsh", "My deal") as any;
  assert.equal(harsh["cfo-strategic-review"].verdict, "ORANGE");
  assert.equal(harsh["cfo-forensic-audit"].verdict, "REWORK");
});

test("runChain produces the full ordered, lineage-linked chain and meters 3 calls", async () => {
  const sel = SCRIPTED_MODELS[1]!; // model-b (adversarial)
  const { artifacts, ledger } = await runChain(registry, [scriptedProviderFor(sel, "ERP re-platform")], sel, "ERP re-platform");
  assert.deepEqual(artifacts.map((a) => a.verdict), ["READY_TO_REVIEW", "ORANGE", "REWORK"]);
  assert.equal(artifacts[1]!.upstreamArtifactId, artifacts[0]!.id);
  assert.equal(artifacts[2]!.upstreamArtifactId, artifacts[1]!.id);
  assert.equal(ledger.length, 3);
  assert.equal(artifacts[0]!.body.title, "ERP re-platform");
});

test("skillSummaries surface verdict vocabularies for the UI", () => {
  const summaries = skillSummaries(registry);
  assert.equal(summaries.length, 3);
  assert.ok(summaries[1]!.verdictVocabulary.includes("ORANGE"));
});
