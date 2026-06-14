# Delivery Roadmap — build · test · deploy

The engineering view of [roadmap.md](roadmap.md): the same five phases, re-cut into three tracks. A phase does not advance until its **exit gate** passes — the same refuse-to-proceed discipline the product applies to decisions, applied to delivery.

## The grid

| Phase | Build | Test | Deploy | Exit gate |
|---|---|---|---|---|
| **0 — Foundation** (wk 1–6) | CFDM v0.1 schema · Harness MVP · Port CFO skills · Shell skeleton | Schema validation · Cert-suite skeletons · 2-provider parity | Monorepo CI bootstrap · Dev environment · Skills = config | CFO chain runs end-to-end on **two LLM providers**, schema-valid |
| **1 — CFO + FP&A live** (wk 7–18) | SAP FI adapter (read) · CFO + FP&A workbenches · Interactive sessions · SSO + RBAC v1 | Adapter cert suite · Provenance / drill-to-source · Harsh-verdict band | Staging + partner canary · CDN shell + module registry · Audit logging on | Real capex decision on **live SAP data**, traced to source |
| **2 — Feature office hours + Controller** (wk 19–32) | Module DSL + palette · Feature chain · Controller cockpit · Oracle + OneStream adapters | **Sandbox security review** · DSL contract tests · Multi-source TB reconciliation | Feature flags · Approval + promotion gate · 3 adapters certified | A business user **ships UI** through office hours, zero sandbox escapes |
| **3 — Treasurer + scale-out** (wk 33–48) | Treasurer workbench · Ariba adapter · Postmortem skills · Writeback v1 (parked) | Writeback approval tests · Load test (10M lines/mo) · Partner-built adapter cert | Multi-region · VPC single-tenant · Region-pinned inference | 3 partners live, **≥1 partner-built adapter** certified |
| **4 — Long tail + GA** (wk 49+) | Tax / IA / AP-AR workbenches · Adapter marketplace | SOC 2 Type II audit · Regression + WCAG 2.1 AA | GA release · Marketplace listing · Pricing/packaging live | **GA** |

## Test track is where phases are won or lost

- **Adapter certification suite** (Phase 1+): golden extracts, provenance completeness, incremental/CDC correctness, throughput floor. Public, so partners build adapter #5+ without core changes.
- **Skill certification** (every phase): each skill version validates its artifact against schema **and** carries red-team cases that *must* produce harsh verdicts. A skill that returns green on a red-team input fails certification. The harsh-verdict rate (25–50% band) is a CI gate, not just a dashboard metric.
- **Sandbox security review** (Phase 2): the load-bearing test. The module DSL boundary — certified components + CFDM queries only, never raw code — is re-reviewed at every change to the DSL. One escape forfeits enterprise trust.
- **Per-provider certification**: because the harness is LLM-agnostic, every skill is certified against each model it is allowed to run on. The router only offers certified skill/model pairs.

## Release cadence — why the architecture stays future-proof

The three things that change fastest each ship on their own clock, decoupled from a core deploy:

| What changes | How it ships | Redeploy core? |
|---|---|---|
| **Models** (new provider, new version) | New gateway driver + re-run certification | No |
| **Skills** (sharper prompt, new chain) | New registry version | No |
| **Modules** (new workbench panel) | Registry promotion through human approval gate | No |
| **Shell · adapters** | CI/CD pipeline | Yes (isolated) |

The compounding asset is the certified skill library, the artifact corpus, and the adapter contracts — none of which require a core deploy to grow. Swapping or adding an LLM is configuration: register a driver, point a route at it, pass certification.

## Deployment topology (target)

- **SaaS default**: multi-tenant control plane; per-tenant data plane (CFDM store + artifact store), region-pinnable.
- **Regulated option**: single-tenant VPC deploy of data plane + harness; adapters run network-adjacent to the source (customer-side agent for on-prem SAP ECC).
- **Front end**: static shell + module registry from CDN; modules are tenant-scoped and flag-gated.
- **Environments**: dev → staging → design-partner canary → prod, with progressive delivery (feature flags) on anything that touches the UI or writes back.
