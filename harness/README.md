# Office Hours harness

The LLM-agnostic backend. Models, skills, and artifacts are swappable parts; the harness is the discipline that connects them. See [docs/architecture.md](../docs/architecture.md#3-the-office-hours-harness).

## Why "harness"

Three things change faster than enterprise sales cycles — models, skills, and UI needs. The harness isolates each so none of them forces a core deploy:

- **New model** → implement a driver + add a route. No skill or runner change.
- **New skill / sharper prompt** → a new registry version (data, not code).
- **Artifacts** → immutable, versioned, lineage-bearing — the audit trail and base-rate memory.

## Layout

```
src/
├── gateway/            # LLM provider gateway — the LLM-independence boundary
│   ├── types.ts        #   LlmProvider interface (one method: complete)
│   ├── gateway.ts      #   per-skill routing, fallback chains, cost metering
│   └── drivers/        #   scripted (CI/dev), anthropic, openai-compatible
├── registry/           # skills as data (skill.json + SKILL.md), versioned
├── artifacts/          # immutable artifact store with full lineage
├── runner/             # executes a skill: sequencing → schema → verdict checks
└── schema/             # dependency-free JSON Schema validate + sample
```

## Run

```bash
npm install          # from the repo root (workspaces)
npm test             # Phase 0 exit gate: CFO chain across two providers
npm run demo         # prints the chain running on a scripted provider
```

## Using a real LLM

The gateway never knows which model answers. To run against a live model, build
the provider list from the environment and point a route at it — no skill or
runner change:

```ts
import { createHarness, liveProvidersFromEnv } from "@fw/harness";

const { runner } = createHarness({
  skillsDir,
  providers: liveProvidersFromEnv(),               // ANTHROPIC_API_KEY / OPENAI_API_KEY
  gateway: { routes: { "*": { primary: { provider: "anthropic", model: "claude-fable-5" } } } },
});
```

The OpenAI-compatible driver also covers Azure OpenAI and any self-hosted /
open-weight endpoint (vLLM, Together, Ollama) — set `baseUrl` and register it.
