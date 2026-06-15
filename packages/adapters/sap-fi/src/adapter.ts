import { CFDM_VERSION, type CfdmEntityKind } from "@fw/canonical-model";
import type {
  FinanceAdapter,
  TenantSourceConfig,
  Connection,
  CapabilityMatrix,
  ExtractRequest,
  CfdmBatch,
  HealthReport,
} from "@fw/adapter-sdk";

import { HttpODataClient, FixtureODataClient, type ODataClient } from "./odata-client.js";
import { mapGLAccount, mapCostCenter, mapTrialBalanceLine, mapJournalEntries, type MapContext } from "./mappers.js";

export interface SapFiAdapterOptions {
  /** Live mode: S/4 OData base URL (token is resolved from the tenant vault). */
  baseUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  /** Test/offline mode: fixture rows keyed by OData entity set. */
  fixture?: Record<string, any[]>;
  /** Override the default OData entity-set names (S/4 vs ECC differ). */
  entitySets?: Partial<Record<CfdmEntityKind, string>>;
  pageSize?: number;
}

const DEFAULT_ENTITY_SETS: Partial<Record<CfdmEntityKind, string>> = {
  Account: "A_GLAccountInChartOfAccounts",
  CostCenter: "A_CostCenter",
  TrialBalanceLine: "A_TrialBalance",
  JournalEntry: "A_JournalEntryItemBasic",
};

/**
 * SAP FI/CO adapter (Phase 1, read-only). Serves GL accounts, cost centers,
 * trial-balance lines, and journal entries as CFDM with mandatory provenance.
 * Writeback is intentionally not implemented yet (Phase 3 — parked documents).
 */
export class SapFiAdapter implements FinanceAdapter {
  readonly source_system = "sap-fi";
  readonly cfdm_version = CFDM_VERSION;

  private entitySets: Partial<Record<CfdmEntityKind, string>>;
  private pageSize: number;
  private clients = new WeakMap<Connection, ODataClient>();

  constructor(private opts: SapFiAdapterOptions) {
    this.entitySets = { ...DEFAULT_ENTITY_SETS, ...opts.entitySets };
    this.pageSize = opts.pageSize ?? 500;
  }

  private makeClient(): ODataClient {
    if (this.opts.fixture) return new FixtureODataClient(this.opts.fixture);
    if (!this.opts.baseUrl) throw new Error("SapFiAdapter requires either `fixture` or `baseUrl`");
    return new HttpODataClient({ baseUrl: this.opts.baseUrl, token: this.opts.token, fetchImpl: this.opts.fetchImpl });
  }

  async connect(config: TenantSourceConfig): Promise<Connection> {
    const conn: Connection = { source_system: this.source_system, tenant_id: config.tenant_id };
    this.clients.set(conn, this.makeClient());
    return conn;
  }

  async discover(_conn: Connection): Promise<CapabilityMatrix> {
    const kinds: CfdmEntityKind[] = ["Account", "CostCenter", "TrialBalanceLine", "JournalEntry"];
    return {
      cfdm_version: this.cfdm_version,
      entities: kinds.map((kind) => ({
        kind,
        granularity: kind === "TrialBalanceLine" ? "summary" : "document",
        history_from: null,
        incremental: kind === "JournalEntry" || kind === "TrialBalanceLine",
      })),
    };
  }

  async *extract(conn: Connection, req: ExtractRequest): AsyncIterable<CfdmBatch> {
    const client = this.clients.get(conn);
    if (!client) throw new Error("connect() must be called before extract()");

    const entitySet = this.entitySets[req.kind];
    if (!entitySet) throw new Error(`SapFiAdapter does not serve CFDM kind "${req.kind}"`);

    const ctx: MapContext = { tenant_id: conn.tenant_id, extracted_at: new Date().toISOString() };
    const top = req.page_size ?? this.pageSize;
    let skip = 0;

    for (;;) {
      const page = await client.list(entitySet, { since: req.since, top, skip });
      if (page.value.length > 0) {
        yield { kind: req.kind, records: this.mapRows(req.kind, page.value, ctx) };
      }
      if (page.nextSkip == null) break;
      skip = page.nextSkip;
    }
  }

  private mapRows(kind: CfdmEntityKind, rows: any[], ctx: MapContext): unknown[] {
    switch (kind) {
      case "Account":
        return rows.map((r) => mapGLAccount(r, ctx));
      case "CostCenter":
        return rows.map((r) => mapCostCenter(r, ctx));
      case "TrialBalanceLine":
        return rows.map((r) => mapTrialBalanceLine(r, ctx));
      case "JournalEntry":
        return mapJournalEntries(rows, ctx);
      default:
        throw new Error(`SapFiAdapter cannot map CFDM kind "${kind}"`);
    }
  }

  async healthcheck(conn: Connection): Promise<HealthReport> {
    const client = this.clients.get(conn);
    if (!client) return { healthy: false, detail: "not connected" };
    const ok = await client.ping();
    return { healthy: ok, detail: ok ? "OData service reachable" : "OData service unreachable" };
  }
}
