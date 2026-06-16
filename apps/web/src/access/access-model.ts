import { evaluate, type Grant, type PersonaId, type ResourceRequirement, type AccessDecision } from "@fw/access";

/** What each persona's workbench reads — the requirement the shell checks before mounting. */
export const WORKBENCH_REQS: Record<PersonaId, ResourceRequirement> = {
  cfo: { persona: "cfo" },
  fpa: { persona: "fpa", ledger: "0L", entities: ["Account", "TrialBalanceLine", "JournalEntry", "CostCenter"] },
  controller: { persona: "controller", ledger: "0L", entities: ["CloseTask", "ReconciliationItem"] },
  treasury: { persona: "treasury" },
  tax: { persona: "tax" },
};

/** Personas whose workbench is actually built (others are phase-gated regardless of grant). */
export const BUILT: PersonaId[] = ["cfo", "fpa"];

export function personaAccess(grant: Grant, persona: PersonaId): AccessDecision {
  return evaluate(grant, WORKBENCH_REQS[persona]);
}

/** The landing persona: the first built workbench the user is actually granted. */
export function firstAccessiblePersona(grant: Grant): PersonaId | null {
  return BUILT.find((p) => personaAccess(grant, p).allowed) ?? null;
}
