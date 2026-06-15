import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SkillRegistry, ProviderGateway, ArtifactStore, SkillRunner, ScriptedProvider } from "@fw/harness";

/**
 * Generates the CFO decision-pipeline dataset by running the REAL harness chain
 * (office-hours -> strategic-review -> forensic-audit) over several scenarios,
 * with the same gating a CFO would apply: review only runs once the thesis is
 * ready, audit only runs if review didn't come back RED. Produces varied
 * verdicts so the workbench's harsh-verdict-rate metric is meaningful.
 *
 * This is the harness's artifact path exercised at build time; the workbench
 * renders only the resulting artifacts.
 */
const here = dirname(fileURLToPath(import.meta.url));
const registry = SkillRegistry.loadFromDir(join(here, "..", "..", "..", "skills"));
const out = join(here, "..", "public", "cfo-deals.json");

type ThesisV = "READY_TO_REVIEW" | "NOT_READY";
type ReviewV = "GREEN" | "YELLOW" | "ORANGE" | "RED";
type AuditV = "PROCEED" | "PROCEED_WITH_VERIFICATIONS" | "REWORK" | "DO_NOT_MODEL";

interface Scenario {
  id: string;
  title: string;
  sponsor: string;
  decisionType: "Capex" | "Strategic initiative" | "Both";
  amount: number;
  thesis: ThesisV;
  review?: ReviewV;
  audit?: AuditV;
}

const SCENARIOS: Scenario[] = [
  { id: "midwest-dc", title: "Midwest distribution center buildout", sponsor: "VP Operations", decisionType: "Capex", amount: 84_000_000, thesis: "READY_TO_REVIEW", review: "GREEN", audit: "PROCEED_WITH_VERIFICATIONS" },
  { id: "erp-replatform", title: "S/4HANA re-platform", sponsor: "CIO", decisionType: "Strategic initiative", amount: 120_000_000, thesis: "READY_TO_REVIEW", review: "ORANGE", audit: "REWORK" },
  { id: "automation-line", title: "Plant 3 automation upgrade", sponsor: "VP Manufacturing", decisionType: "Capex", amount: 31_000_000, thesis: "READY_TO_REVIEW", review: "YELLOW", audit: "PROCEED" },
  { id: "apac-entry", title: "APAC market entry", sponsor: "GM, International", decisionType: "Strategic initiative", amount: 65_000_000, thesis: "READY_TO_REVIEW", review: "RED" },
  { id: "bolton-acq", title: "Bolt-on acquisition — Helix Labs", sponsor: "Head of Corp Dev", decisionType: "Both", amount: 210_000_000, thesis: "READY_TO_REVIEW", review: "GREEN", audit: "DO_NOT_MODEL" },
  { id: "dc-consolidation", title: "Data-center consolidation", sponsor: "VP Infrastructure", decisionType: "Capex", amount: 18_000_000, thesis: "NOT_READY" },
];

const harsh = (v: ReviewV | AuditV) => ["ORANGE", "RED", "REWORK", "DO_NOT_MODEL"].includes(v);

function thesisBody(s: Scenario) {
  return {
    title: s.title,
    decision_type: s.decisionType,
    unit_of_analysis: `The ${s.title.toLowerCase()} evaluated on its own merits; adjacent programs out of scope.`,
    value_thesis: { mechanism: "cost", for_whom: "operating business", one_sentence: `${s.title} is justified by a durable cost or positioning advantage.` },
    cost_of_inaction: "Position erodes and the option closes within ~3 years if unfunded.",
    load_bearing_assumptions: [
      { assumption: "Demand / savings hold above the hurdle", confidence: s.thesis === "READY_TO_REVIEW" ? "M" : "L", if_wrong: "The case fails to clear the hurdle rate." },
    ],
    weakest_assumption: "Demand / savings durability",
    asymmetry: "Becomes a platform advantage if the core assumption compounds.",
    verdict: s.thesis,
  };
}

function reviewBody(s: Scenario, v: ReviewV) {
  return {
    title: `${s.title} — five-lens review`,
    lenses: [
      { lens: "Competitive position", finding: "Relieved-or-threatened test applied.", concern: v === "GREEN" ? "low" : "medium" },
      { lens: "Alternatives", finding: v === "ORANGE" ? "A staged alternative was under-explored and may dominate." : "Alternatives were costed.", concern: v === "ORANGE" || v === "RED" ? "high" : "low" },
      { lens: "Organizational capacity", finding: "Concurrent program load assessed against the inside-company base rate.", concern: v === "RED" ? "high" : "medium" },
      { lens: "Second-order effects", finding: "Downstream incentive effects considered.", concern: "low" },
      { lens: "Optionality", finding: "Real options named with triggers.", concern: v === "GREEN" ? "low" : "medium" },
    ],
    verdict: v,
    recommended_next_step: v === "RED" ? "Do not pursue in this form." : v === "ORANGE" ? "Reframe into a staged commitment before modeling." : "Proceed to assumption audit.",
  };
}

function auditBody(s: Scenario, v: AuditV) {
  const per = v === "DO_NOT_MODEL" ? "REJECTED" : v === "REWORK" ? "WEAK" : v === "PROCEED" ? "HOLDS" : "HOLDS_WITH_CONDITIONS";
  return {
    title: `${s.title} — assumption audit`,
    assumptions_audited: [
      { assumption: "The load-bearing demand / savings assumption", base_rate: "Outside-view base rate applied first.", kill_threshold: "Thesis breaks below the named floor.", headroom: v === "DO_NOT_MODEL" || v === "REWORK" ? "Negative — below the kill point." : "Positive headroom above the base-rate midpoint.", verdict: per },
    ],
    verdict: v,
    portfolio_recommendation: v === "DO_NOT_MODEL" ? "A load-bearing assumption is rejected; modeling would be harm dressed up as rigor." : v === "REWORK" ? "Send the weak assumption back upstream before modeling." : "Proceed to modeling, closing the named verifications first.",
  };
}

async function runScenario(s: Scenario) {
  const script: Record<string, unknown> = { "cfo-office-hours": thesisBody(s) };
  if (s.review) script["cfo-strategic-review"] = reviewBody(s, s.review);
  if (s.audit) script["cfo-forensic-audit"] = auditBody(s, s.audit);

  const gateway = new ProviderGateway([new ScriptedProvider({ id: "cfo-model", script })], {
    tenant: "design-partner-1",
    routes: { "*": { primary: { provider: "cfo-model", model: "claude-fable-5" } } },
  });
  const store = new ArtifactStore();
  const runner = new SkillRunner(registry, gateway, store);

  const artifacts: any[] = [];
  const thesis = await runner.run("cfo-office-hours", { parentObjectId: s.id, userInput: `Deal: ${s.title}` });
  artifacts.push(thesis);

  if (thesis.verdict === "READY_TO_REVIEW" && s.review) {
    const review = await runner.run("cfo-strategic-review", { parentObjectId: s.id, userInput: "Review.", upstreamArtifactId: thesis.id });
    artifacts.push(review);
    if (review.verdict !== "RED" && s.audit) {
      const audit = await runner.run("cfo-forensic-audit", { parentObjectId: s.id, userInput: "Audit.", upstreamArtifactId: review.id });
      artifacts.push(audit);
    }
  }

  const last = artifacts[artifacts.length - 1];
  let status: string;
  if (last.skill === "cfo-forensic-audit") status = last.verdict === "DO_NOT_MODEL" ? "Killed at audit" : last.verdict === "REWORK" ? "Sent back to rework" : "Cleared to model";
  else if (last.skill === "cfo-strategic-review") status = last.verdict === "RED" ? "Rejected at review" : "In review";
  else status = thesis.verdict === "NOT_READY" ? "Not framed" : "Awaiting review";

  return {
    id: s.id,
    title: s.title,
    sponsor: s.sponsor,
    decisionType: s.decisionType,
    amount: s.amount,
    stage: last.skill,
    status,
    artifacts: artifacts.map((a) => ({ skill: a.skill, artifactKind: a.artifactKind, verdict: a.verdict, modelId: a.modelId, createdAt: a.createdAt, body: a.body })),
  };
}

const deals = [];
for (const s of SCENARIOS) deals.push(await runScenario(s));

// Harsh-verdict rate over review + audit artifacts (PRD health metric, target 25-50%).
const decisive = deals.flatMap((d) => d.artifacts).filter((a) => a.skill !== "cfo-office-hours");
const harshCount = decisive.filter((a) => harsh(a.verdict as any)).length;

const dataset = {
  generatedAt: new Date().toISOString(),
  source: "Office Hours harness (CFO chain)",
  tenant: "design-partner-1",
  harshVerdictRate: decisive.length ? harshCount / decisive.length : 0,
  deals,
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(dataset, null, 2));
console.log(`Wrote ${deals.length} deals (harsh-verdict rate ${(dataset.harshVerdictRate * 100).toFixed(0)}%) -> ${out}`);
