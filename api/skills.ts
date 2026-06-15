import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SkillRegistry } from "@fw/harness";
import { skillSummaries } from "../apps/console/lib/console-core.ts";
import bundle from "../apps/console/skills.bundle.json";

const registry = new SkillRegistry(bundle as any);

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ skills: skillSummaries(registry) });
}
