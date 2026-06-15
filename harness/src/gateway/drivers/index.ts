export * from "./scripted.js";
export * from "./anthropic.js";
export * from "./openai.js";

import type { LlmProvider } from "../types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAICompatibleProvider } from "./openai.js";

/**
 * Build whichever live providers have credentials in the environment. Demonstrates
 * that "which LLMs are available" is a deployment/config concern, not a code one.
 */
export function liveProvidersFromEnv(env: NodeJS.ProcessEnv = process.env): LlmProvider[] {
  const providers: LlmProvider[] = [];
  if (env.ANTHROPIC_API_KEY) {
    providers.push(new AnthropicProvider({ id: "anthropic", apiKey: env.ANTHROPIC_API_KEY }));
  }
  if (env.OPENAI_API_KEY) {
    providers.push(
      new OpenAICompatibleProvider({
        id: "openai",
        baseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        apiKey: env.OPENAI_API_KEY,
      }),
    );
  }
  return providers;
}
