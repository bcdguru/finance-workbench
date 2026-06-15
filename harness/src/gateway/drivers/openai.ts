import type { CompletionRequest, CompletionResult, LlmProvider } from "../types.js";

/**
 * OpenAI-compatible driver — talks the /chat/completions wire format over fetch,
 * so a single driver covers OpenAI, Azure OpenAI, and any self-hosted /
 * open-weight endpoint that speaks the OpenAI API (vLLM, Together, Ollama, ...).
 * This is the concrete proof of "use any LLM": point baseUrl at the endpoint,
 * register it, add a route.
 */
export interface OpenAICompatibleOptions {
  id?: string;
  /** e.g. "https://api.openai.com/v1" or "http://localhost:8000/v1". */
  baseUrl: string;
  apiKey?: string;
}

export class OpenAICompatibleProvider implements LlmProvider {
  readonly id: string;

  constructor(private opts: OpenAICompatibleOptions) {
    this.id = opts.id ?? "openai";
  }

  async complete(req: CompletionRequest, model: string): Promise<CompletionResult> {
    const messages = [
      ...(req.system ? [{ role: "system", content: req.system }] : []),
      ...req.messages,
    ];

    const body: Record<string, unknown> = {
      model,
      max_tokens: req.maxTokens ?? 8000,
      messages,
    };
    if (req.responseSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: "artifact", schema: req.responseSchema },
      };
    }

    const r = await fetch(`${this.opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      throw new Error(`OpenAI-compatible "${this.id}" HTTP ${r.status}: ${await r.text()}`);
    }

    const data: any = await r.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";

    let structured: unknown;
    try {
      structured = JSON.parse(text);
    } catch {
      /* not JSON */
    }

    return {
      text,
      structured,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      providerId: this.id,
      modelId: model,
    };
  }
}
