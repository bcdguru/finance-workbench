import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SkillRegistry } from "@fw/harness";
import { SCRIPTED_MODELS, scriptedProviderFor, runChain } from "../apps/console/dist/console-core.js";
import bundle from "../apps/console/skills.bundle.json";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const registry = new SkillRegistry(bundle as any);
    const body = (req.body ?? {}) as { deal?: string; modelId?: string };
    const deal = body.deal?.trim() || "Midwest distribution center buildout";
    const sel = SCRIPTED_MODELS.find((m) => m.id === body.modelId) ?? SCRIPTED_MODELS[0]!;
    const result = await runChain(registry, [scriptedProviderFor(sel, deal)], sel, deal);
    res.status(200).json({ deal, model: sel, ...result });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.stack ?? e) });
  }
}
