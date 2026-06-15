import type { CompletionRequest, CompletionResult, LlmProvider } from "./types.js";

/**
 * ProviderGateway — per-tenant, per-skill model routing with fallback chains and
 * cost metering (PRD FR-10). Switching providers is configuration (a route),
 * never code. Skills and the runner call `complete(skill, req)` and never know
 * which model answered.
 */

export interface RouteTarget {
  provider: string;
  model: string;
}

export interface SkillRoute {
  primary: RouteTarget;
  /** Tried in order if the primary (and prior fallbacks) fail. */
  fallback?: RouteTarget[];
}

export interface GatewayConfig {
  /** Keyed by skill name; the special key "*" is the default route. */
  routes: Record<string, SkillRoute>;
  tenant?: string;
}

export interface MeterRecord {
  tenant?: string;
  skill: string;
  provider: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  at: string;
}

export class ProviderGateway {
  private providers = new Map<string, LlmProvider>();
  private ledger: MeterRecord[] = [];

  constructor(providers: LlmProvider[], private config: GatewayConfig) {
    for (const p of providers) this.providers.set(p.id, p);
  }

  registerProvider(p: LlmProvider): void {
    this.providers.set(p.id, p);
  }

  /** Point a skill (or "*") at a different provider/model — configuration only. */
  setRoute(skill: string, route: SkillRoute): void {
    this.config.routes[skill] = route;
  }

  getLedger(): MeterRecord[] {
    return [...this.ledger];
  }

  private resolveChain(skill: string): RouteTarget[] {
    const route = this.config.routes[skill] ?? this.config.routes["*"];
    if (!route) {
      throw new Error(`No route configured for skill "${skill}" and no default "*" route`);
    }
    return [route.primary, ...(route.fallback ?? [])];
  }

  async complete(skill: string, req: CompletionRequest): Promise<CompletionResult> {
    const chain = this.resolveChain(skill);
    const failures: string[] = [];

    for (const target of chain) {
      const provider = this.providers.get(target.provider);
      if (!provider) {
        failures.push(`provider "${target.provider}" not registered`);
        continue;
      }
      try {
        const result = await provider.complete(req, target.model);
        this.ledger.push({
          tenant: this.config.tenant,
          skill,
          provider: result.providerId,
          model: result.modelId,
          usage: result.usage,
          at: new Date().toISOString(),
        });
        return result;
      } catch (e) {
        failures.push(`${target.provider}/${target.model}: ${(e as Error).message}`);
      }
    }

    throw new Error(`All providers failed for skill "${skill}": ${failures.join("; ")}`);
  }
}
