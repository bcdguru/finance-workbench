import { randomUUID } from "node:crypto";

/**
 * Immutable, versioned artifacts bound to their parent object (deal / close /
 * forecast / feature) with full lineage: upstream artifact, skill version, and
 * the model that produced it (architecture FR-13). This is the audit trail and
 * the base-rate memory postmortem skills read from.
 *
 * Phase 0 is in-memory; the same interface backs a durable store (per-tenant
 * data plane) in later phases — `toJSON()` gives an export hook.
 */
export interface StoredArtifact {
  id: string;
  parentObjectId: string;
  skill: string;
  skillVersion: string;
  artifactKind: string;
  verdict: string;
  upstreamArtifactId: string | null;
  providerId: string;
  modelId: string;
  usage: { inputTokens: number; outputTokens: number };
  body: unknown;
  createdAt: string;
}

export class ArtifactStore {
  private byId = new Map<string, StoredArtifact>();

  put(a: Omit<StoredArtifact, "id" | "createdAt">): StoredArtifact {
    const stored: StoredArtifact = {
      ...a,
      id: `art_${randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    this.byId.set(stored.id, stored);
    return stored;
  }

  get(id: string): StoredArtifact {
    const a = this.byId.get(id);
    if (!a) throw new Error(`Artifact "${id}" not found`);
    return a;
  }

  list(parentObjectId?: string): StoredArtifact[] {
    const all = [...this.byId.values()];
    return parentObjectId ? all.filter((a) => a.parentObjectId === parentObjectId) : all;
  }

  toJSON(): StoredArtifact[] {
    return this.list();
  }
}
