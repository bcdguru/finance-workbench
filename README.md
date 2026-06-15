# Finance Workbench Platform

**A workbench for every persona in corporate Finance — with an AI office-hours backend that lets business users audit, extend, and ship their own features.**

The Office of the CFO runs on a patchwork of ERPs, EPM tools, and spreadsheets. Every persona — CFO, FP&A, Controller, Treasurer, Tax, Internal Audit, AP/AR shared services — re-assembles the same data into their own view of the truth, by hand, every period. This platform replaces that patchwork with two things:

1. **Persona workbenches** — a full-screen, enterprise-grade front end (one workbench per finance persona) that reads from the systems of record through a pluggable adapter layer (SAP FI, Oracle Fusion Finance, Ariba, OneStream, and more).
2. **An office-hours backend** — a chat-driven harness where business users sit down with an AI finance team (built on the [finance-gstack](docs/architecture.md#the-gstack-lineage) skill-chain model: frame → review → audit → build) to pressure-test decisions, audit numbers, and *extend the workbenches themselves* without writing code.

The thesis: the front end is the product surface, but the office-hours harness is the moat. Workbenches that business users can grow themselves don't go stale.

## Repo layout

```
finance-workbench/
├── README.md                  # this file
├── docs/
│   ├── PRD.md                 # product requirements — start here
│   ├── architecture.md        # front-end shell, adapter layer, LLM harness
│   ├── roadmap.md             # phased product plan
│   └── delivery-roadmap.md    # build · test · deploy view with exit gates
├── apps/
│   └── web/                   # workbench shell (Vite + React + IBM Carbon) — Phase 1
├── packages/
│   ├── canonical-model/       # @fw/canonical-model — the CFDM (built)
│   ├── adapter-sdk/           # @fw/adapter-sdk — the published adapter contract (built)
│   └── adapters/              # one package per platform connector — Phase 1+
│       ├── sap-fi/  oracle-fusion/  ariba/  onestream/
├── harness/                   # @fw/harness — LLM gateway, skill runner, artifact store (built)
└── skills/                    # persona skill chains (gstack pattern) — CFO chain ported
```

## Status — Phase 0 (foundation) in progress

The contracts and the LLM-agnostic harness exist and are tested. See [docs/delivery-roadmap.md](docs/delivery-roadmap.md) for the phase gates.

| Built | What |
|---|---|
| [@fw/canonical-model](packages/canonical-model) | CFDM v0.1 entities with mandatory provenance |
| [@fw/adapter-sdk](packages/adapter-sdk) | adapter contract + certification skeleton |
| [@fw/harness](harness) | provider gateway, skill registry/runner, artifact store |
| [skills/](skills) | CFO chain ported from finance-gstack (office-hours → strategic-review → forensic-audit) |

**Phase 0 exit gate (met):** the CFO chain runs end-to-end through the harness against two different LLM providers, producing schema-valid, verdict-bearing artifacts.

```bash
npm install      # workspaces (Node 20+)
npm test         # exit gate — CFO chain across two providers, sequencing, fallback, schema
npm run demo     # watch the chain run on a scripted provider
```

> First-time `npm install` may trip a dependency's lifecycle script in a sandboxed shell; rerun, or use `npm install --ignore-scripts` (the toolchain needs no install scripts).

Next: SAP FI adapter (read-only) and the CFO + FP&A workbenches on real data — Phase 1.

## Design lineage

- **Front end** — patterned on the [Intelligent Finance Platform](https://intelligent-finance-platform-beta.vercel.app/): full-screen workbenches, `#0E2841` headers, IBM Carbon components and color tokens, persona-first navigation.
- **Backend** — patterned on finance-gstack: small, narrow, adversarial skills chained through artifacts, where a skill that always says "yes" is considered broken.
