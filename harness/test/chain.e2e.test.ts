import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { SkillRegistry } from "../src/registry/registry.js";
import { ProviderGateway, type GatewayConfig } from "../src/gateway/gateway.js";
import { ArtifactStore } from "../src/artifacts/store.js";
import { SkillRunner, SequencingError, ArtifactValidationError } from "../src/runner/runner.js";
import { ScriptedProvider } from "../src/gateway/drivers/scripted.js";

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");

/**
 * The Phase 0 exit gate: the CFO chain (office-hours -> strategic-review ->
 * forensic-audit) runs end-to-end through the harness against TWO different LLM
 * providers, producing schema-valid artifacts with verdicts — proving the
 * harness is LLM-agnostic (swapping the model is configuration, not code).
 *
 * Two scripted "providers" stand in for two different LLMs so the gate runs
 * deterministically with no API keys. The real Anthropic and OpenAI-compatible
 * drivers implement the identical interface; an optional live test (gated on
 * env keys) would exercise them, but is not required for the gate.
 */

// Provider A — a model that returns a clean, proceed-able chain.
const PROVIDER_A_SCRIPT: Record<string, unknown> = {
  "cfo-office-hours": {
    title: "Midwest DC buildout",
    decision_type: "Capex",
    unit_of_analysis: "A single 400k sq ft distribution center serving the Midwest region.",
    value_thesis: {
      mechanism: "cost",
      for_whom: "operating business",
      one_sentence: "Cuts outbound freight cost by shortening the line haul to Midwest demand.",
    },
    cost_of_inaction: "Third-party 3PL costs rise ~9%/yr; capacity caps regional growth by 2028.",
    load_bearing_assumptions: [
      { assumption: "Midwest SKU demand grows >= 6% CAGR", confidence: "M", if_wrong: "Freight savings never reach the hurdle." },
    ],
    weakest_assumption: "Midwest SKU demand growth",
    asymmetry: "Becomes a same-day fulfillment hub if demand compounds.",
    verdict: "READY_TO_REVIEW",
  },
  "cfo-strategic-review": {
    title: "Midwest DC buildout — five-lens review",
    lenses: [
      { lens: "Competitive position", finding: "Closes a freight-cost gap vs. two regional competitors.", concern: "low" },
      { lens: "Alternatives", finding: "3PL expansion and a smaller cross-dock were weighed and costed.", concern: "low" },
      { lens: "Organizational capacity", finding: "Two concurrent ERP programs; some delivery risk.", concern: "medium" },
      { lens: "Second-order effects", finding: "Shifts headcount mix toward ops; manageable.", concern: "low" },
      { lens: "Optionality", finding: "Same-day hub option, trigger = 6% CAGR sustained 2 years.", concern: "low" },
    ],
    verdict: "GREEN",
    recommended_next_step: "Audit the Midwest SKU demand-growth assumption.",
  },
  "cfo-forensic-audit": {
    title: "Midwest DC buildout — assumption audit",
    assumptions_audited: [
      {
        assumption: "Midwest SKU demand grows >= 6% CAGR through 2030",
        base_rate: "Regional CPG demand has run 4-7% CAGR over comparable cycles.",
        kill_threshold: "Thesis breaks below 6% SKU CAGR.",
        headroom: "0.8 percentage points above the regional base-rate midpoint.",
        verdict: "HOLDS_WITH_CONDITIONS",
      },
    ],
    verdict: "PROCEED_WITH_VERIFICATIONS",
    portfolio_recommendation: "Proceed to modeling once a third-party demand study confirms the 6% floor.",
  },
};

// Provider B — a DIFFERENT model that, on the same inputs, returns harsher
// verdicts (ORANGE / REWORK). This proves both that the harness is
// provider-agnostic AND that adversarial verdicts flow through unchanged.
const PROVIDER_B_SCRIPT: Record<string, unknown> = {
  "cfo-office-hours": PROVIDER_A_SCRIPT["cfo-office-hours"],
  "cfo-strategic-review": {
    title: "Midwest DC buildout — five-lens review",
    lenses: [
      { lens: "Competitive position", finding: "Freight gap is real but narrowing as rivals automate.", concern: "medium" },
      { lens: "Alternatives", finding: "A staged cross-dock was under-explored and may dominate.", concern: "high" },
      { lens: "Organizational capacity", finding: "Two concurrent ERP programs make a third build risky.", concern: "high" },
      { lens: "Second-order effects", finding: "Locks 15-year fixed cost against an automating market.", concern: "medium" },
      { lens: "Optionality", finding: "A lease-first cross-dock preserves the option the buildout closes.", concern: "high" },
    ],
    verdict: "ORANGE",
    recommended_next_step: "Reframe as a staged cross-dock before any modeling.",
  },
  "cfo-forensic-audit": {
    title: "Midwest DC buildout — assumption audit",
    assumptions_audited: [
      {
        assumption: "Midwest SKU demand grows >= 6% CAGR through 2030",
        base_rate: "Regional CPG demand has run 4-7% CAGR; recent two years at 4.5%.",
        kill_threshold: "Thesis breaks below 6% SKU CAGR.",
        headroom: "Negative — recent trend sits below the kill point.",
        verdict: "WEAK",
      },
    ],
    verdict: "REWORK",
    portfolio_recommendation: "Send the demand assumption back upstream before modeling.",
  },
};

function buildHarness(activeProvider: "model-a" | "model-b") {
  const registry = SkillRegistry.loadFromDir(SKILLS_DIR);
  const providers = [
    new ScriptedProvider({ id: "model-a", script: PROVIDER_A_SCRIPT }),
    new ScriptedProvider({ id: "model-b", script: PROVIDER_B_SCRIPT }),
  ];
  // Route every skill at the chosen provider. Switching the model is ONLY this
  // config — no skill or runner code changes.
  const model = activeProvider === "model-a" ? "claude-fable-5" : "gpt-4o";
  const config: GatewayConfig = {
    tenant: "design-partner-1",
    routes: { "*": { primary: { provider: activeProvider, model } } },
  };
  const gateway = new ProviderGateway(providers, config);
  const store = new ArtifactStore();
  const runner = new SkillRunner(registry, gateway, store);
  return { registry, gateway, store, runner };
}

async function runChain(h: ReturnType<typeof buildHarness>, dealId: string) {
  const thesis = await h.runner.run("cfo-office-hours", {
    parentObjectId: dealId,
    userInput: "We want to build a Midwest distribution center.",
  });
  const review = await h.runner.run("cfo-strategic-review", {
    parentObjectId: dealId,
    userInput: "Review the thesis.",
    upstreamArtifactId: thesis.id,
  });
  const audit = await h.runner.run("cfo-forensic-audit", {
    parentObjectId: dealId,
    userInput: "Audit the load-bearing assumptions.",
    upstreamArtifactId: review.id,
  });
  return { thesis, review, audit };
}

test("CFO chain runs end-to-end on provider A with schema-valid, verdict-bearing artifacts", async () => {
  const h = buildHarness("model-a");
  const { thesis, review, audit } = await runChain(h, "deal-midwest-dc");

  assert.equal(thesis.artifactKind, "strategic-thesis");
  assert.equal(thesis.verdict, "READY_TO_REVIEW");

  assert.equal(review.artifactKind, "strategic-review");
  assert.equal(review.verdict, "GREEN");
  assert.equal(review.upstreamArtifactId, thesis.id);

  assert.equal(audit.artifactKind, "forensic-audit");
  assert.equal(audit.verdict, "PROCEED_WITH_VERIFICATIONS");
  assert.equal(audit.upstreamArtifactId, review.id);

  // Every artifact records which model produced it (audit trail / lineage).
  for (const a of [thesis, review, audit]) {
    assert.equal(a.providerId, "model-a");
    assert.equal(a.modelId, "claude-fable-5");
  }

  // The cost ledger metered all three calls for the tenant.
  assert.equal(h.gateway.getLedger().length, 3);
});

test("the same chain runs unchanged on provider B — LLM choice is configuration", async () => {
  const h = buildHarness("model-b");
  const { thesis, review, audit } = await runChain(h, "deal-midwest-dc");

  // Identical chain, identical code path — only the route changed. The harsher
  // verdicts from the second model flow through the same validation.
  assert.equal(thesis.verdict, "READY_TO_REVIEW");
  assert.equal(review.verdict, "ORANGE");
  assert.equal(audit.verdict, "REWORK");

  for (const a of [thesis, review, audit]) {
    assert.equal(a.providerId, "model-b");
    assert.equal(a.modelId, "gpt-4o");
  }
});

test("sequencing is enforced — a downstream skill refuses to run with no upstream artifact", async () => {
  const h = buildHarness("model-a");
  await assert.rejects(
    () =>
      h.runner.run("cfo-strategic-review", {
        parentObjectId: "deal-x",
        userInput: "Review without a thesis.",
      }),
    SequencingError,
  );
});

test("gateway falls back to a second provider when the primary fails", async () => {
  const registry = SkillRegistry.loadFromDir(SKILLS_DIR);
  const providers = [
    new ScriptedProvider({ id: "model-a", fail: true }),
    new ScriptedProvider({ id: "model-b", script: PROVIDER_B_SCRIPT }),
  ];
  const gateway = new ProviderGateway(providers, {
    routes: {
      "*": {
        primary: { provider: "model-a", model: "claude-fable-5" },
        fallback: [{ provider: "model-b", model: "gpt-4o" }],
      },
    },
  });
  const store = new ArtifactStore();
  const runner = new SkillRunner(registry, gateway, store);

  const thesis = await runner.run("cfo-office-hours", {
    parentObjectId: "deal-y",
    userInput: "Frame the bet.",
  });
  // Primary (model-a) failed; the fallback (model-b) produced the artifact.
  assert.equal(thesis.providerId, "model-b");
});

test("a malformed artifact is rejected by schema validation", async () => {
  const registry = SkillRegistry.loadFromDir(SKILLS_DIR);
  // Scripted output missing required fields (only a title) must fail validation.
  const providers = [new ScriptedProvider({ id: "broken", script: { "cfo-office-hours": { title: "incomplete" } } })];
  const gateway = new ProviderGateway(providers, {
    routes: { "*": { primary: { provider: "broken", model: "test" } } },
  });
  const runner = new SkillRunner(registry, gateway, new ArtifactStore());

  await assert.rejects(
    () => runner.run("cfo-office-hours", { parentObjectId: "deal-z", userInput: "x" }),
    ArtifactValidationError,
  );
});
