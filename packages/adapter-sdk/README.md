# @fw/adapter-sdk — the adapter contract

The published interface every platform connector implements (SAP FI, Oracle Fusion, Ariba, OneStream, and partner-built ones). Because the contract is public and certified, adapter #5+ is a partner exercise with no core change. See [docs/architecture.md](../../docs/architecture.md#2-the-adapter-layer).

## Contract

```ts
interface FinanceAdapter {
  connect(config): Promise<Connection>;
  discover(conn): Promise<CapabilityMatrix>;   // entities × granularity × history × incremental
  extract(conn, req): AsyncIterable<CfdmBatch>; // batch + incremental/CDC
  writeback?(conn, op): Promise<WritebackReceipt>; // optional, gated, source-API + approval only
  healthcheck(conn): Promise<HealthReport>;
}
```

- **Capability negotiation** (`discover`) lets the platform compose a tenant's effective entity map and degrade workbench panels visibly when a source can't serve an entity.
- **Secrets stay with the adapter** (vault ref), never the harness or shell.
- **Writeback is opt-in** per tenant per adapter, always routed through the source system's own API and approval flow (e.g. a *parked* SAP journal, never a direct post).
- **Certification** ([certification.ts](src/certification.ts)) gates publishing — Phase 0 ships the skeleton; Phase 1 adds golden extracts, provenance completeness, incremental correctness, and a throughput floor.
