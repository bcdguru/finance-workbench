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
│   └── roadmap.md             # phased delivery plan
├── apps/
│   └── web/                   # workbench shell (Vite + React + IBM Carbon)
├── packages/
│   ├── canonical-model/       # the canonical finance data model (CFDM)
│   └── adapters/              # one package per platform connector
│       ├── sap-fi/
│       ├── oracle-fusion/
│       ├── ariba/
│       └── onestream/
├── harness/                   # LLM-agnostic backend: gateway, skill runner, artifact store
└── skills/                    # persona skill chains (gstack pattern)
```

## Status

Pre-build. The PRD ([docs/PRD.md](docs/PRD.md)) and architecture ([docs/architecture.md](docs/architecture.md)) are the current deliverables; see [docs/roadmap.md](docs/roadmap.md) for sequencing.

## Design lineage

- **Front end** — patterned on the [Intelligent Finance Platform](https://intelligent-finance-platform-beta.vercel.app/): full-screen workbenches, `#0E2841` headers, IBM Carbon components and color tokens, persona-first navigation.
- **Backend** — patterned on finance-gstack: small, narrow, adversarial skills chained through artifacts, where a skill that always says "yes" is considered broken.
