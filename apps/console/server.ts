import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  SkillRegistry,
  ProviderGateway,
  ArtifactStore,
  SkillRunner,
  ScriptedProvider,
  liveProvidersFromEnv,
  type LlmProvider,
} from "@fw/harness";

/**
 * Office Hours console — a live, zero-dependency web surface for exercising the
 * Phase 0 harness in a browser. It runs the REAL CFO chain through the real
 * @fw/harness runner + gateway and renders the artifacts it produces.
 *
 * Default models are deterministic "scripted" providers (no API keys needed).
 * If ANTHROPIC_API_KEY / OPENAI_API_KEY are present, those live models also
 * appear in the selector — switching the model re-runs the same chain through a
 * different provider, demonstrating the LLM-agnostic routing live.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const skillsDir = join(repoRoot, "skills");
const indexHtml = readFileSync(join(here, "public", "index.html"), "utf8");

const registry = SkillRegistry.loadFromDir(skillsDir);

/** Order the chain by following `upstream` from the root skill. */
function chainOrder(): string[] {
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

interface ModelOption {
  id: string;
  label: string;
  provider: string;
  model: string;
  kind: "scripted" | "live";
  tone?: "clean" | "harsh";
}

function modelOptions(): ModelOption[] {
  const options: ModelOption[] = [
    { id: "model-a", label: "Claude Fable 5 — scripted (clean read)", provider: "model-a", model: "claude-fable-5", kind: "scripted", tone: "clean" },
    { id: "model-b", label: "GPT-4o — scripted (adversarial read)", provider: "model-b", model: "gpt-4o", kind: "scripted", tone: "harsh" },
  ];
  for (const p of liveProvidersFromEnv()) {
    if (p.id === "anthropic") options.push({ id: "live-anthropic", label: "Claude Fable 5 — LIVE", provider: "anthropic", model: "claude-fable-5", kind: "live" });
    if (p.id === "openai") options.push({ id: "live-openai", label: `${process.env.OPENAI_MODEL ?? "gpt-4o"} — LIVE`, provider: "openai", model: process.env.OPENAI_MODEL ?? "gpt-4o", kind: "live" });
  }
  return options;
}

/** Canned artifacts for the scripted providers, with the deal title injected. */
function scriptFor(tone: "clean" | "harsh", deal: string): Record<string, unknown> {
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

  // harsh / adversarial read on the same deal
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

async function runChain(deal: string, sel: ModelOption) {
  let providers: LlmProvider[];
  if (sel.kind === "scripted") {
    providers = [new ScriptedProvider({ id: sel.provider, script: scriptFor(sel.tone ?? "clean", deal) })];
  } else {
    const live = liveProvidersFromEnv().find((p) => p.id === sel.provider);
    if (!live) throw new Error(`live provider "${sel.provider}" not available`);
    providers = [live];
  }

  const gateway = new ProviderGateway(providers, {
    tenant: "console",
    routes: { "*": { primary: { provider: sel.provider, model: sel.model } } },
  });
  const store = new ArtifactStore();
  const runner = new SkillRunner(registry, gateway, store);

  const order = chainOrder();
  const artifacts = [];
  let upstreamId: string | undefined;
  for (const skill of order) {
    const userInput = upstreamId
      ? "Continue the chain on the upstream artifact."
      : `Deal under consideration: ${deal}.`;
    const a = await runner.run(skill, { parentObjectId: deal, userInput, upstreamArtifactId: upstreamId });
    artifacts.push(a);
    upstreamId = a.id;
  }
  return { artifacts, ledger: gateway.getLedger() };
}

function send(res: import("node:http").ServerResponse, status: number, type: string, body: string | Buffer) {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}
function json(res: import("node:http").ServerResponse, status: number, data: unknown) {
  send(res, status, "application/json", JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/") {
    return send(res, 200, "text/html; charset=utf-8", indexHtml);
  }

  if (req.method === "GET" && url.pathname === "/api/skills") {
    const order = chainOrder();
    const skills = order.map((name) => {
      const s = registry.get(name);
      return {
        name: s.name,
        description: s.description,
        mode: s.mode,
        upstream: s.upstream,
        artifactKind: s.artifactKind,
        verdictVocabulary: s.verdictVocabulary,
      };
    });
    return json(res, 200, { skills });
  }

  if (req.method === "GET" && url.pathname === "/api/models") {
    return json(res, 200, { models: modelOptions() });
  }

  if (req.method === "POST" && url.pathname === "/api/run") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body: any;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return json(res, 400, { error: "invalid JSON body" });
    }
    const deal = (body.deal as string)?.trim() || "Midwest distribution center buildout";
    const modelId = body.modelId as string;
    const sel = modelOptions().find((m) => m.id === modelId) ?? modelOptions()[0];
    try {
      const result = await runChain(deal, sel);
      return json(res, 200, { deal, model: sel, ...result });
    } catch (e) {
      return json(res, 500, { error: (e as Error).message });
    }
  }

  send(res, 404, "text/plain", "not found");
});

const port = Number(process.env.PORT ?? 4173);
server.listen(port, () => {
  console.log(`\n  Office Hours console  →  http://localhost:${port}\n`);
  const live = liveProvidersFromEnv().map((p) => p.id);
  console.log(live.length ? `  live providers available: ${live.join(", ")}` : "  (scripted providers only — set ANTHROPIC_API_KEY / OPENAI_API_KEY for live models)\n");
});
