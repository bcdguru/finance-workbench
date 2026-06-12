# Roadmap — Finance Workbench Platform

Phased so that every phase ships something a design partner uses in production, and so the riskiest claims (adapter feasibility, generated-feature safety, harsh-verdict quality) are tested earliest.

## Phase 0 — Foundation (weeks 1–6)

**Goal: the contracts exist and are reviewed before any volume build.**

- CFDM v0.1 schema (entities + mandatory provenance fields) — published for design-partner review
- Adapter contract + certification suite skeleton
- Harness MVP: provider gateway (Anthropic + one OpenAI-compatible driver), skill registry, artifact store, headless runner
- Port the three proven finance-gstack CFO skills (`/cfo-office-hours`, `/cfo-strategic-review`, `/cfo-forensic-audit`) into the registry as the reference chain
- Workbench shell skeleton: auth, nav, theming, module registry, Office Hours panel shell
- **Exit test:** the CFO chain runs end-to-end through the harness against two different LLM providers, producing schema-valid artifacts with verdicts.

## Phase 1 — CFO + FP&A on real data (weeks 7–18)

**Goal: first design partner live on one workbench fed by one real adapter.**

- SAP FI adapter v1 (read-only: GL, TB, journals, cost centers) through certification
- CFO workbench: decision pipeline, artifact timeline, verdict chips, drill-to-source
- FP&A workbench v1: variance work queue + `/fpa-model-interrogation`, `/fpa-variance-review` skills
- Interactive session mode in the Office Hours panel (one-question-at-a-time framing skills)
- Enterprise base: OIDC SSO, RBAC v1, audit logging
- **Exit test:** design partner walks a real capex decision through the full chain with live SAP numbers traced to source; harsh-verdict rate within the 25–50% health band.

## Phase 2 — Feature office hours + Controller (weeks 19–32)

**Goal: a business user ships a UI change with no IT ticket. The moat claim, proven.**

- Module DSL + certified component palette + shell interpreter (sandbox spike → security review → build)
- Feature chain: `/feature-office-hours` → `/feature-design-review` → `/feature-build` → `/feature-acceptance-audit` → human approval gate
- Controller workbench: close cockpit, reconciliation queue (multi-source TB delta), journal review
- Oracle Fusion adapter v1; OneStream adapter v1 (consolidated TB, budget versions)
- **Exit test:** a finance user at a design partner specifies, reviews, and promotes a new workbench panel entirely through office hours; security review of the sandbox passes with no escapes.

## Phase 3 — Treasurer, Ariba, scale-out (weeks 33–48)

- Treasurer workbench: liquidity, cash forecast, FX exposure + treasury skill chain
- Ariba adapter v1 (feeds AP exception queues + S2P views)
- Postmortem skills (`/cfo-postmortem`, variance retrospectives) — artifact corpus starts feeding inside-company base rates
- Writeback v1 (parked journal proposals via SAP adapter, approval-gated)
- Multi-region, VPC single-tenant deploy option
- **Exit test:** second and third design partners live; ≥ 1 partner-built adapter in certification.

## Phase 4 — Long tail personas + GA (weeks 49+)

- Tax, Internal Audit, AP/AR shared-services workbenches and chains
- Adapter marketplace (public contract + certification + listing)
- SOC 2 Type II audit completion
- Pricing/packaging finalized (persona-land-and-expand hypothesis from PRD §7.4)
- GA launch

## Standing tracks (every phase)

- **Skill certification red-teaming** — keep the harsh-verdict rate honest
- **Design-partner office hours** — we use our own feature chain to evolve the product; dogfooding is mandatory
- **Security posture** — sandbox boundary review at every change to the module DSL
