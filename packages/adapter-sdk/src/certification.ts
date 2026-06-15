import type { FinanceAdapter, TenantSourceConfig } from "./contract.js";

/**
 * Adapter certification suite — skeleton (Phase 0). The full suite (Phase 1)
 * adds golden extracts, provenance completeness, incremental correctness, and a
 * throughput floor. The suite is public so partners can self-certify adapter #5+.
 *
 * A check that always passes is as useless here as a skill that always returns
 * GREEN — the suite exists to fail non-conformant adapters before they ship.
 */

export interface CertCheck {
  name: string;
  passed: boolean;
  detail?: string;
}
export interface CertReport {
  source_system: string;
  passed: boolean;
  checks: CertCheck[];
}

export async function certify(
  adapter: FinanceAdapter,
  config: TenantSourceConfig,
): Promise<CertReport> {
  const checks: CertCheck[] = [];

  checks.push({
    name: "declares_cfdm_version",
    passed: typeof adapter.cfdm_version === "string" && adapter.cfdm_version.length > 0,
  });

  let conn;
  try {
    conn = await adapter.connect(config);
    checks.push({ name: "connect", passed: true });
  } catch (e) {
    checks.push({ name: "connect", passed: false, detail: (e as Error).message });
    return finalize(adapter, checks);
  }

  try {
    const caps = await adapter.discover(conn);
    checks.push({
      name: "discover_returns_capability_matrix",
      passed: Array.isArray(caps.entities) && caps.entities.length > 0,
      detail: `${caps.entities.length} entity kinds advertised`,
    });
  } catch (e) {
    checks.push({ name: "discover", passed: false, detail: (e as Error).message });
  }

  try {
    const health = await adapter.healthcheck(conn);
    checks.push({ name: "healthcheck", passed: health.healthy, detail: health.detail });
  } catch (e) {
    checks.push({ name: "healthcheck", passed: false, detail: (e as Error).message });
  }

  // TODO (Phase 1): golden-extract diffs, provenance completeness on every record,
  // incremental/CDC correctness, throughput floor.
  return finalize(adapter, checks);
}

function finalize(adapter: FinanceAdapter, checks: CertCheck[]): CertReport {
  return {
    source_system: adapter.source_system,
    passed: checks.every((c) => c.passed),
    checks,
  };
}
