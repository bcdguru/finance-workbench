import { randomUUID } from "node:crypto";
import type { ProviderGateway } from "../gateway/gateway.js";
import type { SkillDefinition } from "../registry/types.js";
import { ArtifactStore, type StoredArtifact } from "../artifacts/store.js";
import type { LlmMessage } from "../gateway/types.js";
import { validate } from "../schema/jsonschema.js";

/**
 * Interactive sessions (architecture FR-15). Framing skills (`*-office-hours`)
 * are conversational — one question at a time — until they have enough to emit
 * the artifact. The harness must support this mode as well as headless one-shot;
 * collapsing a conversational skill into one shot is a known degradation, so a
 * headless skill is refused here.
 *
 * The core is a STATELESS turn: the caller holds the message history and posts
 * it each turn (the Messages API model). That makes interactive sessions work
 * unchanged on a stateful local server or stateless serverless functions. The
 * `InteractiveSession` class is a thin stateful convenience over it.
 */

export class InteractiveModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InteractiveModeError";
  }
}

export interface TurnInput {
  skill: SkillDefinition;
  gateway: ProviderGateway;
  store: ArtifactStore;
  parentObjectId: string;
  /** Full conversation so far, including the latest user message. */
  messages: LlmMessage[];
}

export interface TurnResult {
  status: "active" | "complete";
  /** The assistant's next question, when the session is still active. */
  question?: string;
  /** The produced, validated artifact, when the session completes. */
  artifact?: StoredArtifact;
  /** Updated history (with the assistant's reply appended) for the next turn. */
  messages: LlmMessage[];
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** A response is the final artifact only if it validates AND carries a vocabulary verdict. */
function artifactFrom(skill: SkillDefinition, obj: unknown): Record<string, any> | null {
  if (!obj || typeof obj !== "object") return null;
  if (validate(obj, skill.artifactSchema).length > 0) return null;
  const verdict = (obj as any)[skill.verdictField];
  if (!skill.verdictVocabulary.includes(verdict)) return null;
  return obj as Record<string, any>;
}

/** Run one conversational turn. Stateless — the caller supplies the full history. */
export async function runInteractiveTurn(input: TurnInput): Promise<TurnResult> {
  const { skill, gateway, store, parentObjectId, messages } = input;
  if (skill.mode !== "interactive") {
    throw new InteractiveModeError(`Skill "${skill.name}" is headless; run it with SkillRunner, not an interactive session.`);
  }

  const result = await gateway.complete(skill.name, {
    system: skill.prompt,
    messages,
    responseSchema: skill.artifactSchema,
    metadata: { skill: skill.name, mode: "interactive", userTurns: messages.filter((m) => m.role === "user").length },
  });

  const nextMessages: LlmMessage[] = [...messages, { role: "assistant", content: result.text }];

  const candidate = artifactFrom(skill, result.structured ?? safeParse(result.text));
  if (candidate) {
    const artifact = store.put({
      parentObjectId,
      skill: skill.name,
      skillVersion: skill.version,
      artifactKind: skill.artifactKind,
      verdict: candidate[skill.verdictField],
      upstreamArtifactId: null,
      providerId: result.providerId,
      modelId: result.modelId,
      usage: result.usage,
      body: candidate,
    });
    return { status: "complete", artifact, messages: nextMessages };
  }

  return { status: "active", question: result.text, messages: nextMessages };
}

/** Stateful convenience wrapper for a single conversation. */
export class InteractiveSession {
  readonly id: string;
  readonly skill: SkillDefinition;
  status: "active" | "complete" = "active";
  artifact?: StoredArtifact;
  private messages: LlmMessage[] = [];

  constructor(
    skill: SkillDefinition,
    private gateway: ProviderGateway,
    private store: ArtifactStore,
    private parentObjectId: string,
  ) {
    if (skill.mode !== "interactive") {
      throw new InteractiveModeError(`Skill "${skill.name}" is headless; use SkillRunner, not an interactive session.`);
    }
    this.skill = skill;
    this.id = `sess_${randomUUID().slice(0, 8)}`;
  }

  getHistory(): LlmMessage[] {
    return [...this.messages];
  }

  /** Send the user's message and get the assistant's question, or the final artifact. */
  async send(userInput: string): Promise<TurnResult> {
    if (this.status === "complete") throw new Error(`session ${this.id} is already complete`);
    this.messages.push({ role: "user", content: userInput });
    const turn = await runInteractiveTurn({
      skill: this.skill,
      gateway: this.gateway,
      store: this.store,
      parentObjectId: this.parentObjectId,
      messages: this.messages,
    });
    this.messages = turn.messages;
    if (turn.status === "complete") {
      this.status = "complete";
      this.artifact = turn.artifact;
    }
    return turn;
  }
}

/** In-memory session registry for a stateful host (the local console server). */
export class SessionManager {
  private sessions = new Map<string, InteractiveSession>();

  constructor(private gateway: ProviderGateway, private store: ArtifactStore) {}

  start(skill: SkillDefinition, parentObjectId: string): InteractiveSession {
    const session = new InteractiveSession(skill, this.gateway, this.store, parentObjectId);
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): InteractiveSession {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`session "${id}" not found`);
    return s;
  }
}
