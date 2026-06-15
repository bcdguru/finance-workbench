import type { CompletionRequest, CompletionResult, LlmProvider } from "../types.js";
import { sampleFromSchema } from "../../schema/jsonschema.js";

/**
 * Deterministic provider for CI, dev, and skill certification. Returns canned
 * (or schema-derived) artifacts with no network or API key — this is what lets
 * the Phase 0 exit gate prove the chain runs across two "providers" without
 * keys, and is the substrate for red-team certification fixtures.
 */
export interface ScriptedProviderOptions {
  id: string;
  /** Canned artifact objects keyed by skill name (read from request.metadata.skill). */
  script?: Record<string, unknown>;
  /** Simulate a provider outage to exercise gateway fallback. */
  fail?: boolean;
  latencyMs?: number;
}

export class ScriptedProvider implements LlmProvider {
  readonly id: string;

  constructor(private opts: ScriptedProviderOptions) {
    this.id = opts.id;
  }

  async complete(req: CompletionRequest, model: string): Promise<CompletionResult> {
    if (this.opts.fail) {
      throw new Error(`scripted provider "${this.id}" is configured to fail`);
    }
    if (this.opts.latencyMs) {
      await new Promise((r) => setTimeout(r, this.opts.latencyMs));
    }

    const skill = (req.metadata?.skill as string) ?? "";
    let obj: unknown;
    if (this.opts.script && skill in this.opts.script) {
      obj = this.opts.script[skill];
    } else if (req.responseSchema) {
      obj = sampleFromSchema(req.responseSchema);
    } else {
      obj = { note: "scripted provider: no schema supplied" };
    }

    const text = JSON.stringify(obj);
    return {
      text,
      structured: obj,
      usage: { inputTokens: estimateTokens(req), outputTokens: Math.ceil(text.length / 4) },
      providerId: this.id,
      modelId: model,
    };
  }
}

function estimateTokens(req: CompletionRequest): number {
  const s = (req.system ?? "") + req.messages.map((m) => m.content).join("");
  return Math.ceil(s.length / 4);
}
