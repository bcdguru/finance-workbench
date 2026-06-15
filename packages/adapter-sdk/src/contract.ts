import type { CfdmEntityKind } from "@fw/canonical-model";

/**
 * The adapter contract (architecture FR-7). An adapter is a versioned package
 * implementing this interface. The certification suite (see certification.ts)
 * gates publishing. Because the contract is public, partners can build adapter
 * #5+ (Workday, NetSuite, Blackline, Kyriba, ...) without core changes.
 */

export interface TenantSourceConfig {
  tenant_id: string;
  source_system: string;
  /** Adapters hold their own secrets via vault; never the harness or the shell. */
  vault_ref: string;
  options?: Record<string, unknown>;
}

export interface Connection {
  readonly source_system: string;
  readonly tenant_id: string;
}

/** What entities/granularity/history depth a source can actually serve. */
export interface CapabilityMatrix {
  cfdm_version: string;
  entities: Array<{
    kind: CfdmEntityKind;
    /** Coarsest granularity available, e.g. "document" | "summary". */
    granularity: "document" | "summary";
    /** How far back history is available, ISO-8601 date or null = unknown. */
    history_from: string | null;
    /** Whether incremental/CDC extraction is supported for this entity. */
    incremental: boolean;
  }>;
}

export interface ExtractRequest {
  kind: CfdmEntityKind;
  /** Omit for a full batch; provide for an incremental/CDC pull. */
  since?: string;
  page_size?: number;
}

export interface CfdmBatch {
  kind: CfdmEntityKind;
  /** CFDM-shaped records (validated by the certification suite). */
  records: unknown[];
  /** Cursor for the next incremental pull, if any. */
  next_cursor?: string;
}

export interface WritebackOp {
  kind: CfdmEntityKind;
  /** Writeback is always a proposal routed through the source's own API + approval
   *  flow (e.g. a *parked* SAP journal, never a direct post). */
  proposal: unknown;
}

export interface WritebackReceipt {
  accepted: boolean;
  source_object_id?: string;
  /** e.g. "parked", "pending_approval". Never "posted" without source-side approval. */
  state: string;
}

export interface HealthReport {
  healthy: boolean;
  detail?: string;
}

export interface FinanceAdapter {
  readonly source_system: string;
  readonly cfdm_version: string;

  connect(config: TenantSourceConfig): Promise<Connection>;
  discover(conn: Connection): Promise<CapabilityMatrix>;
  extract(conn: Connection, req: ExtractRequest): AsyncIterable<CfdmBatch>;
  /** Optional, opt-in per tenant per adapter, always source-API + approval gated. */
  writeback?(conn: Connection, op: WritebackOp): Promise<WritebackReceipt>;
  healthcheck(conn: Connection): Promise<HealthReport>;
}
