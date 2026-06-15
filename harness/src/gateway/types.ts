import type { JsonSchema } from "../schema/jsonschema.js";

/**
 * The single interface every LLM provider implements. This is the abstraction
 * that makes the platform independent of the choice of LLM (PRD FR-10): adding
 * or swapping a model is implementing/registering a driver, never touching skill
 * or runner code.
 */

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  /** System prompt (the skill body). */
  system?: string;
  messages: LlmMessage[];
  /** When set, the provider is asked to return JSON conforming to this schema. */
  responseSchema?: JsonSchema;
  maxTokens?: number;
  /** Free-form routing/metadata, e.g. `{ skill: "cfo-strategic-review" }`. */
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionResult {
  text: string;
  /** Parsed JSON when the provider produced structured output, else undefined. */
  structured?: unknown;
  usage: TokenUsage;
  providerId: string;
  modelId: string;
}

export interface LlmProvider {
  readonly id: string;
  complete(req: CompletionRequest, model: string): Promise<CompletionResult>;
}
