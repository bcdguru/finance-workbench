import {
  ProviderGateway,
  ArtifactStore,
  SkillRunner,
  ScriptedProvider,
  TranscriptProvider,
  runInteractiveTurn,
  type SkillRegistry,
  type LlmProvider,
  type LlmMessage,
} from "@fw/harness";

/**
 * Shared console logic used by both the local Node server (apps/console/server.ts)
 * and the Vercel serverless functions (api/*.ts). Keeping it here means the
 * deployed link and the local dev surface run the exact same chain code.
 */

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  model: string;
  kind: "scripted" | "live";
  tone?: "clean" | "harsh";
}

export const SCRIPTED_MODELS: ModelOption[] = [
  { id: "model-a", label: "Claude Fable 5 — scripted (clean read)", provider: "model-a", model: "claude-fable-5", kind: "scripted", tone: "clean" },
  { id: "model-b", label: "GPT-4o — scripted (adversarial read)", provider: "model-b", model: "gpt-4o", kind: "scripted", tone: "harsh" },
];

/** Order the chain by following `upstream` from the root skill. */
export function chainOrder(registry: SkillRegistry): string[] {
  const skills = registry.list();
  const byUpstream = new Map<string | null, string>();
  for (const s of skills) byUpstream.set(s.upstream, s.name);
  const order: string[] = [];
  let cursor: string | null = null;
  for (let next = byUpstream.get(cursor); next !== undefined; next = byUpstream.get(cursor)) {
    order.push(next);
    cursor = next;
  }
  return order;
}

/** Canned artifacts for the scripted providers, with the deal title injected. */
export function scriptFor(tone: "clean" | "harsh", deal: string): Record<string, unknown> {
  const thesis = {
    title: deal,
    decision_type: "Capex",
    unit_of_analysis: "A single asset evaluated on its own freight-cost economics; team and market entry explicitly out of scope.",
    value_thesis: { mechanism: "cost", for_whom: "operating business", one_sentence: "Shortens the line haul to regional demand and lowers outbound freight cost." },
    cost_of_inaction: "Third-party logistics cost rises ~9%/yr and caps regional capacity by 2028.",
    load_bearing_assumptions: [
      { assumption: "Regional SKU demand grows >= 6% CAGR through 2030", confidence: "M", if_wrong: "Freight savings never clear the hurdle." },
      { assumption: "Freight savings of ~12% land within 12 months", confidence: "L", if_wrong: "Payback period doubles." },
    ],
    weakest_assumption: "Freight savings within 12 months (confidence L)",
    asymmetry: "Becomes a same-day fulfillment hub if regional demand compounds.",
    verdict: "READY_TO_REVIEW",
  };

  if (tone === "clean") {
    return {
      "cfo-office-hours": thesis,
      "cfo-strategic-review": {
        title: `${deal} — five-lens review`,
        lenses: [
          { lens: "Competitive position", finding: "Closes a freight-cost gap vs. two regional competitors.", concern: "low" },
          { lens: "Alternatives", finding: "3PL expansion and a smaller cross-dock were weighed and costed.", concern: "low" },
          { lens: "Organizational capacity", finding: "Two concurrent ERP programs; some delivery risk.", concern: "medium" },
          { lens: "Second-order effects", finding: "Shifts headcount mix toward operations; manageable.", concern: "low" },
          { lens: "Optionality", finding: "Same-day hub option; trigger = 6% CAGR sustained two years.", concern: "low" },
        ],
        verdict: "GREEN",
        recommended_next_step: "Audit the regional demand-growth assumption, then model.",
      },
      "cfo-forensic-audit": {
        title: `${deal} — assumption audit`,
        assumptions_audited: [
          { assumption: "Regional SKU demand grows >= 6% CAGR through 2030", base_rate: "Comparable regional demand has run 4-7% CAGR.", kill_threshold: "Thesis breaks below 6% SKU CAGR.", headroom: "0.8pp above the base-rate midpoint.", verdict: "HOLDS_WITH_CONDITIONS" },
        ],
        verdict: "PROCEED_WITH_VERIFICATIONS",
        portfolio_recommendation: "Proceed to modeling once a third-party demand study confirms the 6% floor.",
      },
    };
  }

  return {
    "cfo-office-hours": thesis,
    "cfo-strategic-review": {
      title: `${deal} — five-lens review`,
      lenses: [
        { lens: "Competitive position", finding: "Freight gap is real but narrowing as rivals automate.", concern: "medium" },
        { lens: "Alternatives", finding: "A staged cross-dock was under-explored and may dominate.", concern: "high" },
        { lens: "Organizational capacity", finding: "Two concurrent ERP programs make a third build risky.", concern: "high" },
        { lens: "Second-order effects", finding: "Locks a 15-year fixed cost against an automating market.", concern: "medium" },
        { lens: "Optionality", finding: "A lease-first cross-dock preserves the option the buildout closes.", concern: "high" },
      ],
      verdict: "ORANGE",
      recommended_next_step: "Reframe as a staged cross-dock before any modeling.",
    },
    "cfo-forensic-audit": {
      title: `${deal} — assumption audit`,
      assumptions_audited: [
        { assumption: "Regional SKU demand grows >= 6% CAGR through 2030", base_rate: "Recent two years ran 4.5%, below the kill point.", kill_threshold: "Thesis breaks below 6% SKU CAGR.", headroom: "Negative — recent trend sits below the kill point.", verdict: "WEAK" },
      ],
      verdict: "REWORK",
      portfolio_recommendation: "Send the demand assumption back upstream before modeling.",
    },
  };
}

export function scriptedProviderFor(sel: ModelOption, deal: string): LlmProvider {
  return new ScriptedProvider({ id: sel.provider, script: scriptFor(sel.tone ?? "clean", deal) });
}

/** Run the full chain (in upstream order) through the given providers + route. */
export async function runChain(
  registry: SkillRegistry,
  providers: LlmProvider[],
  sel: ModelOption,
  deal: string,
) {
  const gateway = new ProviderGateway(providers, {
    tenant: "console",
    routes: { "*": { primary: { provider: sel.provider, model: sel.model } } },
  });
  const store = new ArtifactStore();
  const runner = new SkillRunner(registry, gateway, store);

  const artifacts = [];
  let upstreamId: string | undefined;
  for (const skill of chainOrder(registry)) {
    const userInput = upstreamId ? "Continue the chain on the upstream artifact." : `Deal under consideration: ${deal}.`;
    const a = await runner.run(skill, { parentObjectId: deal, userInput, upstreamArtifactId: upstreamId });
    artifacts.push(a);
    upstreamId = a.id;
  }
  return { artifacts, ledger: gateway.getLedger() };
}

export function skillSummaries(registry: SkillRegistry) {
  return chainOrder(registry).map((name) => {
    const s = registry.get(name);
    return { name: s.name, description: s.description, mode: s.mode, upstream: s.upstream, artifactKind: s.artifactKind, verdictVocabulary: s.verdictVocabulary };
  });
}

/* ------------------------------------------------------------------ */
/* Interactive office hours (FR-15) — conversational, one question at  */
/* a time, until the Strategic Thesis artifact is produced.            */
/* ------------------------------------------------------------------ */

/** A scripted office-hours conversation: the six-question framing, then the thesis. */
export function officeHoursTranscript(deal: string): Array<string | Record<string, unknown>> {
  const thesis = scriptFor("clean", deal)["cfo-office-hours"] as Record<string, unknown>;
  return [
    "Before we touch any numbers — in one paragraph, what decision are you trying to make, and by when?",
    "What exactly is the unit of analysis here? What's in scope, and what's explicitly out?",
    "Where does the durable value come from — cost, revenue, optionality, risk, or positioning — and durable for whom?",
    "What happens to the business in three years if this isn't funded? Don't tell me 'do nothing = $0'.",
    "Which of your load-bearing assumptions would you bet against if you had to? That's the one to diligence first.",
    thesis,
  ];
}

/**
 * Run one stateless office-hours turn. The caller holds the message history and
 * posts it each turn, so this works unchanged on a stateful server or stateless
 * serverless functions.
 */
export async function sessionTurn(registry: SkillRegistry, deal: string, messages: LlmMessage[]) {
  const skill = registry.get("cfo-office-hours");
  const gateway = new ProviderGateway(
    [new TranscriptProvider({ id: "office-hours", transcript: officeHoursTranscript(deal) })],
    { tenant: "console", routes: { "*": { primary: { provider: "office-hours", model: "claude-fable-5" } } } },
  );
  const store = new ArtifactStore();
  return runInteractiveTurn({ skill, gateway, store, parentObjectId: deal, messages });
}
