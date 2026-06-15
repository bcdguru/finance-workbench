import { z } from "zod";
import { Provenance } from "./provenance.js";

/**
 * CFDM v0.1 — a representative subset of the canonical entities. Every entity
 * carries `provenance`. Workbenches and skills read ONLY these shapes, never
 * adapter-specific ones. Additive evolution only; adapters declare which CFDM
 * version they emit (see @fw/adapter-sdk capability negotiation).
 */

const withProvenance = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, provenance: Provenance });

export const Ledger = withProvenance({
  ledger_id: z.string(),
  name: z.string(),
  entity_id: z.string(),
  currency: z.string().length(3),
});
export type Ledger = z.infer<typeof Ledger>;

export const Account = withProvenance({
  account_id: z.string(),
  ledger_id: z.string(),
  number: z.string(),
  name: z.string(),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
});
export type Account = z.infer<typeof Account>;

export const JournalEntry = withProvenance({
  journal_id: z.string(),
  ledger_id: z.string(),
  posted_at: z.string().datetime(),
  lines: z.array(
    z.object({
      account_id: z.string(),
      cost_center_id: z.string().optional(),
      debit: z.number().nonnegative().default(0),
      credit: z.number().nonnegative().default(0),
    }),
  ),
});
export type JournalEntry = z.infer<typeof JournalEntry>;

export const TrialBalanceLine = withProvenance({
  ledger_id: z.string(),
  account_id: z.string(),
  period: z.string(), // e.g. "2026-06"
  debit: z.number(),
  credit: z.number(),
  balance: z.number(),
});
export type TrialBalanceLine = z.infer<typeof TrialBalanceLine>;

export const BudgetVersion = withProvenance({
  budget_version_id: z.string(),
  ledger_id: z.string(),
  name: z.string(),
  fiscal_year: z.number().int(),
  status: z.enum(["draft", "submitted", "approved", "locked"]),
});
export type BudgetVersion = z.infer<typeof BudgetVersion>;

export const CloseTask = withProvenance({
  close_task_id: z.string(),
  period: z.string(),
  name: z.string(),
  owner: z.string(),
  status: z.enum(["not_started", "in_progress", "blocked", "complete"]),
  due_at: z.string().datetime(),
});
export type CloseTask = z.infer<typeof CloseTask>;

export const ReconciliationItem = withProvenance({
  reconciliation_id: z.string(),
  period: z.string(),
  account_id: z.string(),
  /** When two sources emit the same entity, this delta IS the work queue. */
  source_a: z.string(),
  source_b: z.string(),
  difference: z.number(),
  status: z.enum(["open", "investigating", "cleared"]),
});
export type ReconciliationItem = z.infer<typeof ReconciliationItem>;

/** The CFDM entity kinds an adapter can advertise via capability negotiation. */
export const CFDM_ENTITY_KINDS = [
  "Ledger",
  "Account",
  "JournalEntry",
  "TrialBalanceLine",
  "BudgetVersion",
  "CloseTask",
  "ReconciliationItem",
] as const;
export type CfdmEntityKind = (typeof CFDM_ENTITY_KINDS)[number];
