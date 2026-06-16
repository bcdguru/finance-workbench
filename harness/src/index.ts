export * from "./schema/jsonschema.js";
export * from "./gateway/types.js";
export * from "./gateway/gateway.js";
export * from "./gateway/drivers/index.js";
export * from "./registry/types.js";
export * from "./registry/registry.js";
export * from "./artifacts/store.js";
export * from "./runner/runner.js";
export * from "./runner/session.js";

import { SkillRegistry } from "./registry/registry.js";
import { ProviderGateway, type GatewayConfig } from "./gateway/gateway.js";
import { ArtifactStore } from "./artifacts/store.js";
import { SkillRunner } from "./runner/runner.js";
import type { LlmProvider } from "./gateway/types.js";

export interface HarnessOptions {
  skillsDir: string;
  providers: LlmProvider[];
  gateway: GatewayConfig;
}

export interface Harness {
  registry: SkillRegistry;
  gateway: ProviderGateway;
  store: ArtifactStore;
  runner: SkillRunner;
}

/** Compose a harness from a skills directory, a set of providers, and routing. */
export function createHarness(opts: HarnessOptions): Harness {
  const registry = SkillRegistry.loadFromDir(opts.skillsDir);
  const gateway = new ProviderGateway(opts.providers, opts.gateway);
  const store = new ArtifactStore();
  const runner = new SkillRunner(registry, gateway, store);
  return { registry, gateway, store, runner };
}
