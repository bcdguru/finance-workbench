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

/**
 * Deterministic provider for interactive sessions. Returns the Nth scripted
 * response based on how many user turns are in the request — so it is stateless
 * (no internal counter) and behaves identically on a stateful local server or a
 * stateless serverless function. A transcript ends with the final artifact object.
 */
export interface TranscriptProviderOptions {
  id: string;
  /** Ordered responses: question strings, then the final artifact object. */
  transcript: Array<string | Record<string, unknown>>;
}

export class TranscriptProvider implements LlmProvider {
  readonly id: string;

  constructor(private opts: TranscriptProviderOptions) {
    this.id = opts.id;
  }

  async complete(req: CompletionRequest, model: string): Promise<CompletionResult> {
    const userTurns = req.messages.filter((m) => m.role === "user").length;
    const idx = Math.min(Math.max(userTurns - 1, 0), this.opts.transcript.length - 1);
    const entry = this.opts.transcript[idx];
    const text = typeof entry === "string" ? entry : JSON.stringify(entry);
    const structured = typeof entry === "string" ? undefined : entry;
    return {
      text,
      structured,
      usage: { inputTokens: estimateTokens(req), outputTokens: Math.ceil(text.length / 4) },
      providerId: this.id,
      modelId: model,
    };
  }
}
