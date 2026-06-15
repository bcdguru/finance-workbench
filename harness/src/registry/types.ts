import type { JsonSchema } from "../schema/jsonschema.js";

export type SkillMode = "interactive" | "headless";

/**
 * A skill is data, not code (architecture FR-11): a markdown prompt + frontmatter
 * + an artifact JSON Schema + a verdict vocabulary. The registry versions all of
 * it together. `prompt` is loaded from the sibling SKILL.md; the rest from skill.json.
 */
export interface SkillDefinition {
  name: string;
  version: string;
  description: string;
  /** Interactive (one-question-at-a-time framing) vs headless (review/audit/build). */
  mode: SkillMode;
  /** Upstream skill whose artifact this one consumes, or null to start a chain. */
  upstream: string | null;
  artifactKind: string;
  /** Top-level field of the artifact carrying the verdict. */
  verdictField: string;
  /** Allowed verdicts — MUST include adversarial ones, or the skill is broken. */
  verdictVocabulary: string[];
  artifactSchema: JsonSchema;
  /** Default model for this skill (a route may override per tenant). */
  modelDefault?: string;
  /** SKILL.md body, loaded from disk. */
  prompt: string;
}
