# @fw/adapter-sap-fi — SAP FI/CO adapter (Phase 1, read-only)

Implements the [@fw/adapter-sdk](../../adapter-sdk) contract for SAP FI/CO. Serves **GL accounts, cost centers, trial-balance lines, and journal entries** as CFDM with mandatory provenance. Writeback is intentionally not implemented yet (Phase 3 — parked documents).

## Transport

The adapter speaks to SAP through a small `ODataClient` interface, so the same mapping logic runs against:

- **Live S/4** — `HttpODataClient` (REST/JSON OData; token resolved from the tenant vault, never the harness).
- **Fixture / offline** — `FixtureODataClient` backed by [fixtures.ts](src/fixtures.ts), so the adapter is testable and demoable with no live SAP.

Entity-set names default to S/4 conventions and are overridable per release (S/4 vs ECC extractor gateway).

## CFDM mapping

| CFDM kind | SAP entity set (default) | Notes |
|---|---|---|
| `Account` | `A_GLAccountInChartOfAccounts` | GL account type → CFDM account type |
| `CostCenter` | `A_CostCenter` | blocked cost centers flagged inactive |
| `TrialBalanceLine` | `A_TrialBalance` | period = `FY-PP`; incremental via change date |
| `JournalEntry` | `A_JournalEntryItemBasic` | line items grouped by accounting document into balanced entries |

Every record carries `provenance` (`source_system: "sap-fi"`, `source_object_id` = the SAP document key, `extracted_at`, `transform_version`).

## Certification

The adapter passes the [@fw/adapter-sdk certification suite](../../adapter-sdk/src/certification.ts) (connect / discover / healthcheck) and the package's own gate adds CFDM schema validation, provenance completeness, journal balancing, paging, and incremental (changed-since) behavior.

```bash
npm run test:sap     # 9 cases, all green
```

## Usage

```ts
import { SapFiAdapter, SAP_FI_FIXTURE } from "@fw/adapter-sap-fi";

// offline / test
const adapter = new SapFiAdapter({ fixture: SAP_FI_FIXTURE });
// live
// const adapter = new SapFiAdapter({ baseUrl: "https://my-s4/sap/opu/odata/sap/...", token });

const conn = await adapter.connect({ tenant_id, source_system: "sap-fi", vault_ref });
for await (const batch of adapter.extract(conn, { kind: "TrialBalanceLine" })) {
  // batch.records are CFDM TrialBalanceLine[] with provenance
}
```
