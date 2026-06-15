# Persona skill chains (gstack pattern)

Each skill is **data, not code**: a `skill.json` (frontmatter + artifact JSON Schema + verdict vocabulary) plus a `SKILL.md` (the prompt). The harness registry loads these at runtime; a new skill or a sharper prompt ships as a new version with no harness deploy.

## CFO chain (ported from finance-gstack — Phase 0)

```
cfo-office-hours  →  cfo-strategic-review  →  cfo-forensic-audit
READY_TO_REVIEW /     GREEN / YELLOW /          PROCEED / PROCEED_WITH_VERIFICATIONS /
NOT_READY             ORANGE / RED              REWORK / DO_NOT_MODEL
```

Each skill declares its `upstream`; the runner refuses to start a skill whose upstream artifact is missing (no work on un-framed inputs). Every `verdictVocabulary` includes adversarial verdicts on purpose — a skill that can only return the green verdict is broken.

## Adding a skill

1. Create `skills/<name>/skill.json` and `skills/<name>/SKILL.md`.
2. `skill.json` fields: `name`, `version`, `description`, `mode` (`interactive` | `headless`), `upstream` (skill name or `null`), `artifactKind`, `verdictField`, `verdictVocabulary`, `artifactSchema` (JSON Schema), `modelDefault`.
3. The artifact schema must carry a top-level field named by `verdictField`, constrained to `verdictVocabulary`.
4. Skill certification (Phase 1+) adds red-team cases that must produce harsh verdicts.
