import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHarness } from "./index.js";
import { ScriptedProvider } from "./gateway/drivers/index.js";

/**
 * Runnable demo of the CFO chain through the harness on a scripted provider.
 *   npm run demo
 *
 * Swap the scripted provider for `liveProvidersFromEnv()` and set ANTHROPIC_API_KEY
 * or OPENAI_API_KEY to run the same chain against a real model — no code change
 * beyond the provider list and the route.
 */
const skillsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");

const script: Record<string, unknown> = {
  "cfo-office-hours": {
    title: "Demo deal",
    decision_type: "Capex",
    unit_of_analysis: "One asset.",
    value_thesis: { mechanism: "cost", for_whom: "operating business", one_sentence: "Lowers unit cost." },
    load_bearing_assumptions: [{ assumption: "Volume holds", confidence: "M", if_wrong: "No payback." }],
    verdict: "READY_TO_REVIEW",
  },
  "cfo-strategic-review": {
    title: "Demo deal — review",
    lenses: [{ lens: "Optionality", finding: "Lease-first preserves the option.", concern: "high" }],
    verdict: "ORANGE",
    recommended_next_step: "Reframe as a staged commitment.",
  },
  "cfo-forensic-audit": {
    title: "Demo deal — audit",
    assumptions_audited: [
      { assumption: "Volume holds", base_rate: "Below trend.", kill_threshold: "Breaks under 6%.", verdict: "WEAK" },
    ],
    verdict: "REWORK",
    portfolio_recommendation: "Back upstream before modeling.",
  },
};

const { runner, gateway } = createHarness({
  skillsDir,
  providers: [new ScriptedProvider({ id: "demo-model", script })],
  gateway: { tenant: "demo", routes: { "*": { primary: { provider: "demo-model", model: "claude-fable-5" } } } },
});

const dealId = "deal-demo";
const thesis = await runner.run("cfo-office-hours", { parentObjectId: dealId, userInput: "Frame a capex bet." });
const review = await runner.run("cfo-strategic-review", { parentObjectId: dealId, userInput: "Review it.", upstreamArtifactId: thesis.id });
const audit = await runner.run("cfo-forensic-audit", { parentObjectId: dealId, userInput: "Audit it.", upstreamArtifactId: review.id });

console.log("CFO chain artifacts:");
for (const a of [thesis, review, audit]) {
  console.log(`  ${a.skill.padEnd(22)} -> ${a.verdict.padEnd(28)} [${a.modelId}]  ${a.id}`);
}
console.log(`\nMetered ${gateway.getLedger().length} model calls for tenant "demo".`);
