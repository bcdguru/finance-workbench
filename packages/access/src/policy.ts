/**
 * RBAC v1 (architecture FR-1 / FR-5). Access is scoped on three axes — persona,
 * ledger, and CFDM entity. The shell refuses to mount a workbench whose
 * requirements exceed the signed-in user's grant; the same `evaluate` runs
 * server-side at the CFDM Query API in production (the client gate is UX, the
 * server gate is the boundary). Browser-safe: no Node-only dependencies.
 */
export type PersonaId = "cfo" | "fpa" | "controller" | "treasury" | "tax";

/** A user's effective entitlements (resolved from SSO claims / role mapping). */
export interface Grant {
  subject: string;
  role: string;
  /** Personas the user may open. */
  personas: PersonaId[];
  /** Ledger ids in scope, or ["*"] for all. */
  ledgers: string[];
  /** CFDM entity kinds in scope, or ["*"] for all. */
  entities: string[];
}

/** What a workbench/module needs in order to mount. */
export interface ResourceRequirement {
  persona: PersonaId;
  ledger?: string;
  entities?: string[];
}

export interface AccessDecision {
  allowed: boolean;
  /** Human-readable denial reasons; empty when allowed. */
  reasons: string[];
}

const inScope = (granted: string[], needed: string): boolean =>
  granted.includes("*") || granted.includes(needed);

export function evaluate(grant: Grant, req: ResourceRequirement): AccessDecision {
  const reasons: string[] = [];

  if (!grant.personas.includes(req.persona)) {
    reasons.push(`requires the ${req.persona.toUpperCase()} persona grant`);
  }
  if (req.ledger && !inScope(grant.ledgers, req.ledger)) {
    reasons.push(`ledger ${req.ledger} is outside your scope`);
  }
  for (const entity of req.entities ?? []) {
    if (!inScope(grant.entities, entity)) reasons.push(`entity ${entity} is outside your scope`);
  }

  return { allowed: reasons.length === 0, reasons };
}

/** Filter CFDM-like rows to the user's ledger scope (server-side enforcement helper). */
export function scopeLedgers<T extends { ledger_id?: string }>(grant: Grant, rows: T[]): T[] {
  if (grant.ledgers.includes("*")) return rows;
  return rows.filter((r) => r.ledger_id == null || grant.ledgers.includes(r.ledger_id));
}
