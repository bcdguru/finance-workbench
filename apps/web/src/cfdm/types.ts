/**
 * Structural CFDM types the workbench renders. These mirror @fw/canonical-model
 * but are declared locally so the browser bundle doesn't import the workspace
 * source package — the data itself is produced and zod-validated by the adapter
 * at generation time (scripts/gen-cfdm.ts).
 */
export interface Provenance {
  source_system: string;
  source_object_id: string;
  extracted_at: string;
  transform_version: string;
}

export interface Account {
  account_id: string;
  ledger_id: string;
  number: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  provenance: Provenance;
}

export interface CostCenter {
  cost_center_id: string;
  name: string;
  responsible?: string;
  active: boolean;
  provenance: Provenance;
}

export interface TrialBalanceLine {
  ledger_id: string;
  account_id: string;
  period: string;
  debit: number;
  credit: number;
  balance: number;
  provenance: Provenance;
}

export interface JournalLine {
  account_id: string;
  cost_center_id?: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  journal_id: string;
  ledger_id: string;
  posted_at: string;
  lines: JournalLine[];
  provenance: Provenance;
}

export interface CfdmDataset {
  generatedAt: string;
  source: string;
  cfdmVersion: string;
  tenant: string;
  accounts: Account[];
  costCenters: CostCenter[];
  trialBalance: TrialBalanceLine[];
  journals: JournalEntry[];
}

/** What the drill-to-source panel renders. */
export interface DrillTarget {
  title: string;
  subtitle?: string;
  provenance: Provenance;
}
