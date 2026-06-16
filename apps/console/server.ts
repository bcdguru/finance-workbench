import { createServer, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { SkillRegistry, liveProvidersFromEnv, type LlmMessage } from "@fw/harness";
import {
  SCRIPTED_MODELS,
  scriptedProviderFor,
  runChain,
  skillSummaries,
  sessionTurn,
  type ModelOption,
} from "./lib/console-core.js";

/**
 * Local dev server for the Office Hours console (run: `npm run console`). Serves
 * the same static page and runs the same chain code as the Vercel deployment
 * (api/*.ts) via the shared console-core. Live models appear when API keys are set.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const registry = SkillRegistry.loadFromDir(join(repoRoot, "skills"));
const indexHtml = readFileSync(join(here, "public", "index.html"), "utf8");

function modelOptions(): ModelOption[] {
  const options = [...SCRIPTED_MODELS];
  for (const p of liveProvidersFromEnv()) {
    if (p.id === "anthropic") options.push({ id: "live-anthropic", label: "Claude Fable 5 — LIVE", provider: "anthropic", model: "claude-fable-5", kind: "live" });
    if (p.id === "openai") options.push({ id: "live-openai", label: `${process.env.OPENAI_MODEL ?? "gpt-4o"} — LIVE`, provider: "openai", model: process.env.OPENAI_MODEL ?? "gpt-4o", kind: "live" });
  }
  return options;
}

function send(res: ServerResponse, status: number, type: string, body: string) {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}
const json = (res: ServerResponse, status: number, data: unknown) => send(res, status, "application/json", JSON.stringify(data));

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/") return send(res, 200, "text/html; charset=utf-8", indexHtml);
  if (req.method === "GET" && url.pathname === "/api/skills") return json(res, 200, { skills: skillSummaries(registry) });
  if (req.method === "GET" && url.pathname === "/api/models") return json(res, 200, { models: modelOptions() });

  if (req.method === "POST" && url.pathname === "/api/session") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let body: any;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return json(res, 400, { error: "invalid JSON body" });
    }
    const deal = (body.deal as string)?.trim() || "a strategic investment";
    const messages: LlmMessage[] = Array.isArray(body.messages) ? body.messages : [];
    try {
      return json(res, 200, await sessionTurn(registry, deal, messages));
    } catch (e) {
      return json(res, 500, { error: (e as Error).message });
    }
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
    const sel = modelOptions().find((m) => m.id === body.modelId) ?? SCRIPTED_MODELS[0]!;
    const providers = sel.kind === "scripted" ? [scriptedProviderFor(sel, deal)] : liveProvidersFromEnv().filter((p) => p.id === sel.provider);
    try {
      const result = await runChain(registry, providers, sel, deal);
      return json(res, 200, { deal, model: sel, ...result });
    } catch (e) {
      return json(res, 500, { error: (e as Error).message });
    }
  }

  send(res, 404, "text/plain", "not found");
});

const port = Number(process.env.PORT ?? 4173);
server.listen(port, () => {
  console.log(`\n  Office Hours console  ->  http://localhost:${port}\n`);
  const live = liveProvidersFromEnv().map((p) => p.id);
  console.log(live.length ? `  live providers available: ${live.join(", ")}` : "  (scripted providers only — set ANTHROPIC_API_KEY / OPENAI_API_KEY for live models)\n");
});
