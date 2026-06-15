import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SkillRegistry } from "@fw/harness";
import { skillSummaries } from "../apps/console/dist/console-core.js";
import bundle from "../apps/console/skills.bundle.json";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const registry = new SkillRegistry(bundle as any);
    res.status(200).json({ skills: skillSummaries(registry) });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.stack ?? e) });
  }
}
