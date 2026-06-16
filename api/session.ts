import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SkillRegistry, type LlmMessage } from "@fw/harness";
import { sessionTurn } from "../apps/console/dist/console-core.js";
import bundle from "../apps/console/skills.bundle.json";

const registry = new SkillRegistry(bundle as any);

/**
 * One conversational office-hours turn. Stateless: the client posts the full
 * message history each turn and gets back the assistant's next question, or the
 * finished Strategic Thesis artifact when the framing is complete.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const body = (req.body ?? {}) as { deal?: string; messages?: LlmMessage[] };
    const deal = body.deal?.trim() || "a strategic investment";
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const turn = await sessionTurn(registry, deal, messages);
    res.status(200).json(turn);
  } catch (e: any) {
    res.status(500).json({ error: String(e?.stack ?? e) });
  }
}
