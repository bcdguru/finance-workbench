# Product Requirements — Finance Workbench Platform

**Version:** 0.1 (founding draft)
**Date:** 2026-06-12
**Author:** Founder / Product Owner
**Status:** For review — this is the framing document; nothing downstream starts until this survives challenge.

---

## 1. The problem

Corporate Finance is the last large enterprise function still operated through generic tools. The systems of record (SAP FI, Oracle Fusion, Ariba, OneStream, Workday Financials) are excellent ledgers and terrible workplaces. So every finance persona builds a shadow workbench out of Excel, email, and tribal knowledge:

- The **Controller** runs the close out of a checklist spreadsheet and a folder of reconciliations.
- **FP&A** rebuilds the same driver model every cycle and reconciles it to the GL by hand.
- The **Treasurer** stitches liquidity views from bank portals and a cash spreadsheet.
- The **CFO** receives all of this as static decks, with no way to interrogate the assumptions underneath.

Two structural failures follow:

1. **The workbench gap.** No vendor ships a persona-native working surface across the Office of the CFO. ERP vendors ship transaction screens; EPM vendors ship modeling cubes; BI vendors ship dashboards. Nobody ships *the place where a Controller actually works a close* or *where a CFO actually pressure-tests a capex thesis*.
2. **The change-request death spiral.** When finance users need the tooling to change, they file IT tickets. The backlog is months long, requirements decay in transit, and the delivered feature is wrong by the time it ships. Finance tooling is permanently 18 months behind finance reality.

## 2. The product thesis

> **Give every finance persona a purpose-built workbench, and give the business users themselves the power to audit and extend those workbenches through structured AI office hours — so the platform improves at the speed of the finance team, not the IT backlog.**

Two coupled products, one platform:

- **The Workbench (front end):** one full-screen, enterprise-grade workspace per persona, fed by live data from the customer's existing systems through an adapter layer. We do not replace the ERP. We are the working surface on top of it.
- **Office Hours (backend):** a chat-driven harness where a business user runs structured sessions with AI skills — to pressure-test a decision (the finance-gstack chain), to audit a number back to its source, or to specify, review, and ship a change to their own workbench. Every session produces an artifact; every artifact is versioned; every change is auditable.

The differentiated claim: **the users grow the product.** Office Hours is not a copilot bolted onto a dashboard — it is the platform's own change-management process, made safe enough for finance (artifacts, verdicts, audit trails, human approval gates) that business users can drive it.

## 3. Who it's for — the personas

Each persona gets a workbench (front end) and a skill chain (backend). All workbenches follow the same UX standard: full-screen layout, `#0E2841` header, `#156082` icon accent, IBM Carbon components and color tokens.

| Persona | Workbench centers on | Signature skill chain (gstack pattern) | Phase |
|---|---|---|---|
| **CFO** | Decision pipeline: capital allocation, strategic initiatives, board readiness | `/cfo-office-hours` → `/cfo-strategic-review` → `/cfo-forensic-audit` → `/cfo-board-prep` → `/cfo-postmortem` | 1 |
| **FP&A** | Driver-based planning, variance, rolling forecast, scenarios | `/fpa-model-interrogation` → `/fpa-model-build` → `/fpa-variance-review` → `/fpa-scenario-explorer` | 1 |
| **Controller** | Close cockpit: checklist, reconciliations, journal review, flux analysis | `/controller-close-interrogation` → `/controller-reconciliation-auditor` → `/controller-journal-entry-audit` → `/controller-compliance-audit` | 2 |
| **Treasurer** | Liquidity, cash forecasting, FX exposure, capital structure | `/treasury-liquidity-review` → `/treasury-exposure-audit` → `/treasury-scenario-stress` | 2 |
| **Tax** | Provision, transfer pricing posture, jurisdiction risk register | `/tax-provision-review` → `/tax-position-audit` | 3 |
| **Internal Audit** | Controls testing, SOX evidence, issue tracking | `/audit-scope-interrogation` → `/audit-controls-test` | 3 |
| **AP / AR shared services** | Exception queues, aging, dispute workbench | `/ap-exception-triage`, `/ar-collections-review` | 3 |

Persona order is deliberate: CFO and FP&A first because they are the decision-making spine and the executive sponsors; Controller and Treasurer next because they consume the strategic chain's outputs; Tax / IA / shared services after the canonical data model has hardened.

## 4. Core requirements

### 4.1 The Workbench (front end)

**FR-1. Workbench shell.** A single shell application hosts all persona workbenches as independently deployable modules (module-federation / micro-frontend). Adding a workbench must never require redeploying another. Shell owns: auth, navigation, theming, notification bus, and the Office Hours side panel.

**FR-2. Persona home = work queue, not dashboard.** Each workbench opens on *what needs doing* (close tasks due, variances breaching threshold, deals awaiting audit, cash positions outside policy), with dashboards one level down. Inspiration: the Intelligent Finance Platform workbenches (R2R/O2C/S2P/FP&A).

**FR-3. Drill-to-source everywhere.** Every number rendered in any workbench must be traceable to its adapter, source system, and source object (e.g., GL line → SAP FI document number) in ≤ 3 clicks. Provenance is a first-class UI element, not a tooltip.

**FR-4. Artifact viewer.** Office Hours artifacts (theses, review memos, audit reports, model specs) render natively in the workbench with verdict chips (GREEN/YELLOW/ORANGE/RED etc.), timeline view per decision/close/forecast, and diff view between artifact versions.

**FR-5. Enterprise readiness.** SSO (SAML/OIDC), RBAC mapped to persona + entity + ledger scope, SOC 2-ready audit logging of every read and write, accessibility (WCAG 2.1 AA — Carbon gives most of this), and white-label theming within the Carbon token system.

### 4.2 The adapter layer

**FR-6. Canonical Finance Data Model (CFDM).** All workbenches read only CFDM entities — never adapter-specific shapes. v1 entities: Ledger, Account, JournalEntry, TrialBalance, CostCenter/ProfitCenter, Vendor/Customer, Invoice, Payment, PurchaseOrder, BudgetVersion, ForecastVersion, FXRate, BankAccount/CashPosition, CloseTask, ReconciliationItem. Every entity carries mandatory provenance fields (`source_system`, `source_object_id`, `extracted_at`, `transform_version`).

**FR-7. Adapter contract.** An adapter is a versioned package implementing a published interface: `connect`, `discover` (capability negotiation — what entities/granularity this source supports), `extract` (batch + incremental/CDC), `writeback` (optional, gated, always via the source system's own API and approval flow), `healthcheck`. Certification suite required before an adapter ships.

**FR-8. Launch adapters.** SAP FI/CO (OData + extractor-based), Oracle Fusion Financials (REST/BICC), SAP Ariba (procurement/AP), OneStream (EPM/consolidation). Architecture must make adapter #5 (e.g., Workday Financials, NetSuite, Blackline, Kyriba) a partner-buildable exercise against the public contract — no core changes.

**FR-9. Graceful degradation.** When a source lacks an entity (capability negotiation says no), the dependent workbench panel must degrade visibly ("not available from your sources") rather than render empty or wrong.

### 4.3 Office Hours (backend harness)

**FR-10. LLM-agnostic harness.** The backend is a harness, not an app hard-wired to one model. A provider gateway abstracts Anthropic, OpenAI, Google, Azure-hosted, and customer-hosted/open-weight models behind one interface (completion, tool use, streaming, structured output). Models are configured per skill per tenant; switching providers is configuration, not code. Per-tenant routing, cost metering, fallback chains, and prompt/response logging are gateway concerns.

**FR-11. Skill registry and runner.** Skills follow the gstack discipline: one input artifact, one output artifact, one decision class, an explicit verdict vocabulary, and a refusal rule (a skill will not start if its upstream artifact is missing or mushy — it redirects the user upstream). The registry stores skill definitions (markdown prompt + frontmatter + JSON schema for the artifact) and versions them. The runner executes a skill against a model from the gateway, validates the output artifact against schema, and persists it.

**FR-12. A skill that always returns the green verdict is broken.** Adversarial verdicts (ORANGE/RED, WEAK/REJECTED, REWORK/DO NOT MODEL) are a product requirement, not a tone choice. Skill certification includes red-team cases that must produce harsh verdicts.

**FR-13. Artifact store.** Every session output is a versioned, immutable, schema-validated artifact bound to its decision/close/forecast object, its upstream artifact, the skill version, and the model used. This is the audit trail regulators and internal audit will ask for.

**FR-14. Feature office hours — business users extend the front end.** The flagship capability. A business user opens an Office Hours session of type `feature` and walks a chain modeled directly on the CFO chain:

```
/feature-office-hours      → Feature Thesis (what, for whom, why now, what it replaces)
/feature-design-review     → Design Memo (GREEN/YELLOW/ORANGE/RED against UX standard + CFDM)
/feature-build             → generated workbench module (sandboxed, behind a flag)
/feature-acceptance-audit  → Acceptance Report (PASS / PASS WITH CONDITIONS / FAIL)
        → human approval gate (workbench owner) → promote to tenant
```

Generated features are constrained to a safe surface: composing certified Carbon components and CFDM queries inside a sandboxed module slot — never raw code into the shell, never direct source-system writes. Audit ("why does this panel show this number?") and extension ("add a DSO trend panel to my AR workbench") both run through this same chain.

**FR-15. Conversational where it matters.** Framing skills (any `*-office-hours`) are interactive, one question at a time. Downstream skills (review, audit, build) run headless. The harness must support both modes; collapsing a conversational skill into one-shot mode is a known failure (documented in finance-gstack) and must be prevented by skill metadata.

### 4.4 Non-functional requirements

| Area | Requirement |
|---|---|
| Tenancy | Multi-tenant SaaS with single-tenant/VPC deploy option for regulated customers |
| Data residency | Region-pinnable storage; model inference region selectable per tenant |
| Security | SOC 2 Type II path from day one; encryption at rest/in transit; no source credentials in the harness — adapters hold their own secrets via vault |
| AI governance | Per-tenant model allowlists; full prompt/response retention policy controls; artifacts always attribute model + skill version; human approval gate on anything that changes the UI or writes back |
| Performance | Workbench initial load < 3s; CFDM queries p95 < 1.5s on 5-year ledger history; office-hours first token < 2s |
| Scale | 50k GL accounts, 200 entities/ledgers, 10M journal lines/month per tenant without architecture change |

## 5. What this product is NOT

- **Not an ERP or a system of record.** We never master financial data; we read it, frame it, and trace back to it.
- **Not a BI tool.** Dashboards exist but are secondary to work queues and decision chains.
- **Not a general chatbot.** Office Hours sessions are structured, artifact-producing, verdict-bearing skill chains. Free-form chat with no artifact is out of scope.
- **Not a citizen-developer free-for-all.** Feature office hours generates modules within a certified component/query sandbox with a human approval gate — not arbitrary code.

## 6. Success metrics

| Metric | Target (12 months post-GA) |
|---|---|
| Time-to-live for a new tenant (first workbench on real data) | < 2 weeks |
| % of UI change requests resolved through feature office hours (vs. vendor backlog) | > 60% |
| Artifacts per decision (capex deals carrying full thesis→audit trail) | > 80% of deals over threshold |
| Close cycle reduction (Controller workbench tenants) | ≥ 2 days |
| Harsh-verdict rate (ORANGE/RED + WEAK/REJECTED share of review/audit artifacts) | 25–50% — below 25% suggests rubber-stamping; investigate |
| Adapter ecosystem | ≥ 2 partner-built adapters against the public contract |

The harsh-verdict rate as a *health metric* is deliberate: if the AI office hours agrees with everyone, the moat is gone.

## 7. Risks and open questions

1. **Adapter depth vs. breadth.** Four launch adapters is aggressive. Mitigation: certify read-only extraction first; writeback is a later, per-adapter milestone.
2. **Generated-feature safety.** The sandbox boundary (certified components + CFDM queries only) is load-bearing; a single escape destroys enterprise trust. Needs a dedicated security review before Phase 2.
3. **Model variance.** LLM-agnostic means verdict quality varies by model. Mitigation: skill certification suites run per model; tenants see certified model/skill pairs only.
4. **Buy-side question.** Does the Controller buy a workbench, or does IT buy a platform? Pricing and packaging study needed before GA — current hypothesis: land with one persona workbench (Controller close or CFO decisions), expand by persona.
5. **Conversational skill quality headless** — known sharp edge from finance-gstack; enforced via skill metadata (FR-15), but needs UX design for "interactive required" sessions inside the workbench panel.

## 8. Next steps

1. Approve/redline this PRD (founder review — apply `/cfo-strategic-review` discipline to our own document).
2. Architecture deep-dive sign-off ([architecture.md](architecture.md)).
3. Phase 1 build per [roadmap.md](roadmap.md): workbench shell + CFDM + SAP FI adapter (read-only) + harness MVP with the CFO chain ported from finance-gstack.
4. Design-partner recruitment: 3 enterprises (one SAP-centric, one Oracle-centric, one OneStream consolidation customer).
