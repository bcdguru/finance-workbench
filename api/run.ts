import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SkillRegistry } from "@fw/harness";
import { SCRIPTED_MODELS, scriptedProviderFor, runChain } from "../apps/console/lib/console-core.ts";
import bundle from "../apps/console/skills.bundle.json";

const registry = new SkillRegistry(bundle as any);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = (req.body ?? {}) as { deal?: string; modelId?: string };
  const deal = body.deal?.trim() || "Midwest distribution center buildout";
  const sel = SCRIPTED_MODELS.find((m) => m.id === body.modelId) ?? SCRIPTED_MODELS[0]!;
  try {
    const result = await runChain(registry, [scriptedProviderFor(sel, deal)], sel, deal);
    res.status(200).json({ deal, model: sel, ...result });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
}
