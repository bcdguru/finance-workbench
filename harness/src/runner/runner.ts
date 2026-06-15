import type { ProviderGateway } from "../gateway/gateway.js";
import type { SkillRegistry } from "../registry/registry.js";
import { ArtifactStore, type StoredArtifact } from "../artifacts/store.js";
import { validate } from "../schema/jsonschema.js";

/**
 * The runner executes one skill against a model resolved by the gateway. It
 * enforces the gstack discipline:
 *   1. Sequencing — refuse to start if the upstream artifact is missing/mismatched.
 *   2. Schema — the output must validate against the skill's artifact schema.
 *   3. Verdict — the verdict must be one of the skill's declared vocabulary.
 * It never knows which LLM answered; that is the gateway's concern.
 */

export class SequencingError extends Error {
  constructor(public skill: string, public upstream: string) {
    super(
      `Skill "${skill}" requires the upstream artifact from "${upstream}". Run /${upstream} first — no work on un-framed inputs.`,
    );
    this.name = "SequencingError";
  }
}

export class ArtifactValidationError extends Error {
  constructor(public skill: string, public errors: { path: string; message: string }[]) {
    super(
      `Artifact from "${skill}" failed schema validation: ${errors
        .map((e) => `${e.path} ${e.message}`)
        .join("; ")}`,
    );
    this.name = "ArtifactValidationError";
  }
}

export class VerdictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerdictError";
  }
}

export interface RunInput {
  parentObjectId: string;
  userInput: string;
  upstreamArtifactId?: string;
}

export class SkillRunner {
  constructor(
    private registry: SkillRegistry,
    private gateway: ProviderGateway,
    private store: ArtifactStore,
  ) {}

  async run(skillName: string, input: RunInput): Promise<StoredArtifact> {
    const skill = this.registry.get(skillName);

    // 1. Sequencing rule.
    let upstream: StoredArtifact | null = null;
    if (skill.upstream) {
      if (!input.upstreamArtifactId) throw new SequencingError(skillName, skill.upstream);
      upstream = this.store.get(input.upstreamArtifactId);
      if (upstream.skill !== skill.upstream) throw new SequencingError(skillName, skill.upstream);
    }

    const userContent = upstream
      ? `${input.userInput}\n\n--- Upstream artifact (${upstream.skill}, verdict ${upstream.verdict}) ---\n${JSON.stringify(
          upstream.body,
          null,
          2,
        )}`
      : input.userInput;

    const result = await this.gateway.complete(skillName, {
      system: skill.prompt,
      messages: [{ role: "user", content: userContent }],
      responseSchema: skill.artifactSchema,
      metadata: { skill: skillName },
    });

    // 2. Parse + schema validation.
    let body: any;
    try {
      body = result.structured ?? JSON.parse(result.text);
    } catch {
      throw new ArtifactValidationError(skillName, [
        { path: "$", message: "response was not valid JSON" },
      ]);
    }
    const errors = validate(body, skill.artifactSchema);
    if (errors.length) throw new ArtifactValidationError(skillName, errors);

    // 3. Verdict vocabulary.
    const verdict = body[skill.verdictField];
    if (!skill.verdictVocabulary.includes(verdict)) {
      throw new VerdictError(
        `Skill "${skillName}" returned verdict "${verdict}" not in vocabulary [${skill.verdictVocabulary.join(
          ", ",
        )}]`,
      );
    }

    return this.store.put({
      parentObjectId: input.parentObjectId,
      skill: skill.name,
      skillVersion: skill.version,
      artifactKind: skill.artifactKind,
      verdict,
      upstreamArtifactId: upstream?.id ?? null,
      providerId: result.providerId,
      modelId: result.modelId,
      usage: result.usage,
      body,
    });
  }
}
