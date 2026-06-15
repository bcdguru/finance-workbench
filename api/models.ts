import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SCRIPTED_MODELS } from "../apps/console/dist/console-core.js";

// The public deployment runs scripted providers only — no API keys on a shared
// link. (Set keys as Vercel env vars + add live options here to enable live models.)
export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    res.status(200).json({ models: SCRIPTED_MODELS });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.stack ?? e) });
  }
}
