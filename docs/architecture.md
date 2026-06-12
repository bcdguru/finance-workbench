# Architecture — Finance Workbench Platform

High-level architecture for the two coupled halves of the platform: the persona workbench front end with its adapter layer, and the LLM-agnostic Office Hours harness. Companion to [PRD.md](PRD.md).

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            WORKBENCH SHELL (web)                         │
│  auth · nav · theming · notifications · Office Hours panel               │
│  ┌─────────┐ ┌─────────┐ ┌────────────┐ ┌──────────┐ ┌────────────────┐  │
│  │   CFO   │ │  FP&A   │ │ Controller │ │ Treasurer│ │ generated      │  │
│  │workbench│ │workbench│ │ workbench  │ │workbench │ │ feature modules│  │
│  └────┬────┘ └────┬────┘ └─────┬──────┘ └────┬─────┘ └───────┬────────┘  │
└───────┼───────────┼────────────┼─────────────┼───────────────┼───────────┘
        ▼           ▼            ▼             ▼               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              CFDM QUERY API  (canonical entities + provenance)           │
└───────┬──────────────────────────────────────────────────────┬───────────┘
        ▼                                                      ▼
┌─────────────────────────────┐                 ┌─────────────────────────────┐
│        ADAPTER LAYER        │                 │     OFFICE HOURS HARNESS    │
│ ┌────────┐ ┌──────────────┐ │                 │ ┌─────────────────────────┐ │
│ │ SAP FI │ │Oracle Fusion │ │                 │ │ skill registry + runner │ │
│ ├────────┤ ├──────────────┤ │  artifacts ◄──► │ ├─────────────────────────┤ │
│ │ Ariba  │ │  OneStream   │ │                 │ │ artifact store (audit)  │ │
│ └────────┘ └──────────────┘ │                 │ ├─────────────────────────┤ │
│  contract: connect/discover │                 │ │ LLM provider gateway    │ │
│  extract/writeback/health   │                 │ │ (Anthropic·OpenAI·…)    │ │
└─────────────────────────────┘                 └─────────────────────────────┘
```

---

## 1. Front end — the workbench shell

### 1.1 Stack

- **Vite + React + TypeScript**, **IBM Carbon Design System** components and color tokens (proven in the Intelligent Finance Platform reference implementation).
- **UX standard (non-negotiable, applies to every workbench including generated modules):** full-screen layout, `#0E2841` header, `#156082` icon accent, Carbon `Button`/`Tag`/`DataTable` primitives, Carbon color tokens only — no ad-hoc hex values in modules.

### 1.2 Shell vs. modules

The shell is the only always-deployed front-end artifact. It owns cross-cutting concerns:

| Shell owns | Modules own |
|---|---|
| Auth (OIDC/SAML), session, RBAC context | Persona screens, work queues, panels |
| Navigation + persona switcher | Their own routes under `/wb/{persona}` |
| Theming (Carbon tokens, tenant white-label) | Nothing visual outside tokens |
| Notification bus | Emitting/subscribing to typed events |
| Office Hours side panel (chat + artifact view) | Deep links into sessions ("audit this number") |
| Module registry + sandboxed module slots | Manifest: required CFDM entities, RBAC scope |

Persona workbenches and generated feature modules load through the same module registry (module federation). A module's manifest declares which CFDM entities and scopes it needs; the shell refuses to mount a module whose requirements exceed the user's RBAC grant. This single mechanism serves both first-party workbenches and office-hours-generated features — generated features are not a special case, they are just modules whose author was the harness.

### 1.3 The generated-module sandbox

Feature office hours (PRD FR-14) emits modules constrained to:

- **Certified component palette:** a curated, versioned set of Carbon-based composites (KPI tile, trend panel, drillable table, aging waterfall, variance bridge, queue list). No arbitrary JSX reaches the shell.
- **CFDM queries only:** modules declare data needs as CFDM query descriptors executed by the platform, never raw SQL/HTTP. Provenance and RBAC enforcement come free.
- **Declarative composition:** a generated module is a JSON/DSL document (layout + component bindings + query descriptors), rendered by the shell's interpreter. This is the load-bearing safety boundary: the LLM writes configuration, not code.
- **Lifecycle:** sandbox tenant slot → acceptance audit artifact → human approval gate → promotion. Every promotion is a versioned, diffable, revertible artifact.

### 1.4 Drill-to-source

Every rendered figure carries its CFDM provenance chain (`source_system`, `source_object_id`, `extracted_at`, `transform_version`). The shell provides one universal "trace this number" affordance that opens the provenance panel and, where the adapter supports it, deep-links into the source system (e.g., SAP document display). This is a shell capability so no module can opt out.

---

## 2. The adapter layer

### 2.1 Canonical Finance Data Model (CFDM)

The CFDM is the contract between sources and surfaces. Workbenches and skills speak CFDM exclusively. Design rules:

1. **Provenance is mandatory** on every entity instance — no orphan numbers.
2. **Versioned schema** with additive evolution; adapters declare which CFDM version they emit.
3. **Capability negotiation:** an adapter's `discover()` returns the entity/granularity matrix it can serve (e.g., Ariba serves PO/Invoice/Vendor but not TrialBalance). The platform composes the tenant's effective capability map across all connected adapters; workbench panels degrade visibly when an entity is unavailable (PRD FR-9).
4. **Multi-source reconciliation is a feature, not a bug:** when two sources emit the same entity (OneStream consolidated TB vs. SAP local TB), the CFDM keeps both with provenance and exposes the difference — that delta *is* the Controller's reconciliation work queue.

### 2.2 Adapter contract

```typescript
interface FinanceAdapter {
  connect(config: TenantSourceConfig): Promise<Connection>;
  discover(conn: Connection): Promise<CapabilityMatrix>;     // entities × granularity × history depth
  extract(conn: Connection, req: ExtractRequest): AsyncIterable<CfdmBatch>;  // batch + incremental/CDC
  writeback?(conn: Connection, op: WritebackOp): Promise<WritebackReceipt>;  // optional, gated, source-API only
  healthcheck(conn: Connection): Promise<HealthReport>;
}
```

- Adapters are versioned packages, run in isolated workers, and hold their own secrets via vault — credentials never transit the harness or the shell.
- **Certification suite** (golden extracts, provenance completeness, incremental correctness, throughput floor) gates publishing. The suite is public so partners can build adapter #5+ without core changes.
- **Writeback is opt-in per tenant per adapter**, always routed through the source system's own API and approval workflow (e.g., a journal entry proposal lands in SAP as a *parked* document, never posted directly).

### 2.3 Launch adapters

| Adapter | Transport | v1 scope |
|---|---|---|
| SAP FI/CO | OData (S/4) + extractor fallback (ECC) | GL, TB, journal lines, cost centers, vendors/customers, open items |
| Oracle Fusion Financials | REST + BICC extracts | GL, TB, journals, suppliers, AP/AR |
| SAP Ariba | Ariba APIs | PO, invoice, vendor, approval flows (feeds AP persona + S2P views) |
| OneStream | REST/XF | Consolidated TB, budget/forecast versions, FX rates, close status |

---

## 3. The Office Hours harness

The backend is deliberately a **harness** — the gstack pattern industrialized. Models, skills, and artifacts are all swappable parts; the harness is the discipline that connects them.

### 3.1 LLM provider gateway

One internal interface (`complete`, `stream`, `toolUse`, `structuredOutput`) with provider drivers: Anthropic, OpenAI, Google, Azure-hosted, Bedrock, and customer-hosted open-weight endpoints (vLLM/OpenAI-compatible). Gateway responsibilities:

- **Per-tenant, per-skill model routing** with fallback chains — switching providers is configuration, not code.
- **Cost metering and budgets** per tenant/persona/skill.
- **Compliance:** prompt/response retention per tenant policy, region pinning, model allowlists.
- **Certification binding:** a skill version is certified against specific models; the router only offers certified pairs (PRD risk #3).

### 3.2 Skill registry and runner

A skill is data, not code: `SKILL.md` prompt + frontmatter + an artifact JSON schema + certification cases. Registry versions all three together. The runner:

1. Resolves the session's upstream artifact; **refuses to start** if missing/unvalidated and redirects upstream (the gstack sequencing rule).
2. Executes against the routed model — **interactive mode** (one question at a time, for `*-office-hours` framing skills) or **headless** (review/audit/build skills). Mode is skill metadata; the runner will not run an interactive skill headless.
3. Validates the output against the artifact schema, including a **verdict field from the skill's declared vocabulary**.
4. Persists the artifact with full lineage: upstream artifact id, skill version, model id, token costs, timestamps.

Certification cases include red-team inputs that must yield harsh verdicts (ORANGE/RED/WEAK/REJECTED/FAIL). A skill that passes everything green fails certification — this operationalizes the founding principle that *a skill that always returns the green verdict is broken*.

### 3.3 Artifact store

Immutable, versioned, schema-validated documents bound to a parent object (deal, close period, forecast cycle, feature request). The store is the platform's audit trail and its memory: postmortem skills read historical artifacts to build inside-company base rates (the most under-built feedback loop in real corporate finance). Artifacts render in the workbench artifact viewer with verdict chips, timelines, and version diffs.

### 3.4 Session types

| Session type | Chain | Output |
|---|---|---|
| **Decision** | persona office-hours → review → audit → (model) | thesis, memo, audit report |
| **Audit** | "trace/justify this number" → forensic chain over CFDM provenance | audit artifact bound to the queried figure |
| **Feature** | feature-office-hours → design-review → build → acceptance-audit → human gate | sandboxed module + promotion record |
| **Postmortem** | actuals vs. past artifacts' kill thresholds | retrospective artifact, feeds base rates |

### 3.5 Why a harness and not an app

Three things change faster than enterprise sales cycles: models, skills, and UI needs. The harness isolates each:

- New model → new gateway driver + re-run certification. No skill or UI changes.
- New skill / sharper prompt → new registry version. No deploy.
- New UI need → feature office hours session by the user who needs it. No backlog.

The company's compounding asset is therefore not any model integration — it is the **library of certified skills, the artifact corpus, and the adapter contracts**. Everything else is replaceable on purpose.

---

## 4. Deployment topology

- **SaaS default:** multi-tenant control plane; per-tenant data plane (CFDM store + artifact store) with region pinning.
- **Regulated option:** single-tenant VPC deploy of data plane + harness; adapters always run network-adjacent to sources (customer-side agent for on-prem SAP ECC).
- **Front end:** static shell + module registry from CDN; modules are tenant-scoped.

## 5. Open architecture decisions (tracked, not resolved)

1. CFDM persistence: lakehouse (Iceberg/DuckDB-style) vs. Postgres-first with columnar extension — decide after Phase 1 load tests.
2. Module DSL: adopt an existing declarative UI spec vs. own minimal schema — prototype both in Phase 2 spike.
3. Interactive sessions transport: SSE vs. WebSocket in the Office Hours panel (note finance-gstack's Windows pipe-buffering lesson — heartbeats required regardless).
4. Multi-entity/multi-ledger consolidation semantics in CFDM v1 vs. defer to OneStream adapter passthrough.
