# @fw/canonical-model — CFDM

The Canonical Finance Data Model: the contract between source systems and persona workbenches. Workbenches and skills read **only** CFDM shapes (zod schemas + inferred types), never adapter-specific ones.

- **Provenance is mandatory** on every entity (`source_system`, `source_object_id`, `extracted_at`, `transform_version`) — no number exists without a traceable origin. See [provenance.ts](src/provenance.ts).
- **v0.1 entities** (representative subset): Ledger, Account, JournalEntry, TrialBalanceLine, BudgetVersion, CloseTask, ReconciliationItem. See [entities.ts](src/entities.ts).
- **Multi-source by design:** when two sources emit the same entity, the CFDM keeps both with provenance; the delta is the Controller's reconciliation queue (`ReconciliationItem`).

Additive evolution only; adapters declare which CFDM version they emit via capability negotiation in [@fw/adapter-sdk](../adapter-sdk).
