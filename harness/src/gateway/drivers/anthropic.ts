import type { CompletionRequest, CompletionResult, LlmProvider } from "../types.js";

/**
 * Anthropic driver — uses the official @anthropic-ai/sdk (loaded lazily so the
 * harness has zero hard runtime deps; the CI gate runs on the scripted provider
 * with no SDK installed). Default model is the latest Claude, `claude-fable-5`.
 *
 * Adaptive thinking is the only thinking mode on Fable 5 / Opus 4.8; temperature
 * and budget_tokens are intentionally omitted (they 400 on those models). The
 * skill's JSON Schema is passed via output_config.format for structured output.
 */
export interface AnthropicProviderOptions {
  id?: string;
  apiKey?: string;
}

export class AnthropicProvider implements LlmProvider {
  readonly id: string;
  private clientPromise?: Promise<any>;

  constructor(private opts: AnthropicProviderOptions = {}) {
    this.id = opts.id ?? "anthropic";
  }

  private async client(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = import("@anthropic-ai/sdk")
        .then((m) => {
          const Anthropic = (m as any).default ?? (m as any).Anthropic;
          return new Anthropic(this.opts.apiKey ? { apiKey: this.opts.apiKey } : {});
        })
        .catch((e) => {
          throw new Error(
            `Anthropic driver requires the "@anthropic-ai/sdk" package: ${(e as Error).message}`,
          );
        });
    }
    return this.clientPromise;
  }

  async complete(req: CompletionRequest, model: string): Promise<CompletionResult> {
    const client = await this.client();
    const res = await client.messages.create({
      model,
      max_tokens: req.maxTokens ?? 8000,
      ...(req.system ? { system: req.system } : {}),
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      ...(req.responseSchema
        ? { output_config: { format: { type: "json_schema", schema: req.responseSchema } } }
        : {}),
    });

    const text = (res.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    let structured: unknown;
    try {
      structured = JSON.parse(text);
    } catch {
      /* not JSON — leave undefined */
    }

    return {
      text,
      structured,
      usage: {
        inputTokens: res.usage?.input_tokens ?? 0,
        outputTokens: res.usage?.output_tokens ?? 0,
      },
      providerId: this.id,
      modelId: model,
    };
  }
}
