import { CFDM_VERSION, type Provenance, type Account, type TrialBalanceLine, type CostCenter, type JournalEntry } from "@fw/canonical-model";

/**
 * Maps SAP FI/CO OData rows into CFDM entities. Every mapper stamps mandatory
 * provenance so the value can be traced back to its SAP document. The SAP field
 * names below follow S/4 OData conventions; ECC extractors map to the same shape.
 */

export interface MapContext {
  tenant_id: string;
  /** ISO-8601 extraction timestamp, stamped onto every record's provenance. */
  extracted_at: string;
}

const SOURCE = "sap-fi";
const TRANSFORM_VERSION = `sap-fi@0.1.0/cfdm@${CFDM_VERSION}`;

function provenance(source_object_id: string, ctx: MapContext): Provenance {
  return { source_system: SOURCE, source_object_id, extracted_at: ctx.extracted_at, transform_version: TRANSFORM_VERSION };
}

const num = (v: unknown): number => (v == null || v === "" ? 0 : Number(v));

/** SAP GL account classification -> CFDM account type. */
function accountType(glAccountType: string): Account["type"] {
  switch (glAccountType) {
    case "X": // balance sheet
    case "A": // asset
      return "asset";
    case "L":
      return "liability";
    case "Q": // equity
      return "equity";
    case "N": // non-operating expense/income treated as revenue when credit
    case "R":
      return "revenue";
    default:
      return "expense";
  }
}

export function mapGLAccount(row: any, ctx: MapContext): Account {
  return {
    account_id: `${row.GLAccount}`,
    ledger_id: `${row.Ledger ?? "0L"}`,
    number: `${row.GLAccount}`,
    name: row.GLAccountName ?? row.GLAccountLongName ?? `${row.GLAccount}`,
    type: accountType(row.GLAccountType ?? ""),
    provenance: provenance(`${row.GLAccount}`, ctx),
  };
}

export function mapCostCenter(row: any, ctx: MapContext): CostCenter {
  return {
    cost_center_id: `${row.CostCenter}`,
    name: row.CostCenterName ?? `${row.CostCenter}`,
    responsible: row.PersonResponsible ?? undefined,
    active: row.IsBlocked === true ? false : true,
    provenance: provenance(`${row.CostCenter}`, ctx),
  };
}

export function mapTrialBalanceLine(row: any, ctx: MapContext): TrialBalanceLine {
  const debit = num(row.DebitAmountInGlobalCrcy ?? row.Debit);
  const credit = num(row.CreditAmountInGlobalCrcy ?? row.Credit);
  return {
    ledger_id: `${row.Ledger ?? "0L"}`,
    account_id: `${row.GLAccount}`,
    period: `${row.FiscalYear}-${String(row.FiscalPeriod).padStart(2, "0")}`,
    debit,
    credit,
    balance: num(row.BalanceAmountInGlobalCrcy ?? debit - credit),
    provenance: provenance(`${row.Ledger ?? "0L"}/${row.GLAccount}/${row.FiscalYear}${row.FiscalPeriod}`, ctx),
  };
}

/**
 * SAP returns journals as line items (ACDOCA-style). Group them by accounting
 * document into a CFDM JournalEntry with lines.
 */
export function mapJournalEntries(rows: any[], ctx: MapContext): JournalEntry[] {
  const byDoc = new Map<string, any[]>();
  for (const r of rows) {
    const key = `${r.CompanyCode}/${r.FiscalYear}/${r.AccountingDocument}`;
    const list = byDoc.get(key) ?? [];
    list.push(r);
    byDoc.set(key, list);
  }
  const out: JournalEntry[] = [];
  for (const [key, items] of byDoc) {
    const head = items[0];
    out.push({
      journal_id: key,
      ledger_id: `${head.Ledger ?? "0L"}`,
      posted_at: head.PostingDate ?? ctx.extracted_at,
      lines: items.map((it) => {
        const signed = num(it.AmountInCompanyCodeCurrency ?? it.Amount);
        const isDebit = (it.DebitCreditCode ?? (signed >= 0 ? "S" : "H")) === "S";
        const mag = Math.abs(signed);
        return {
          account_id: `${it.GLAccount}`,
          cost_center_id: it.CostCenter ? `${it.CostCenter}` : undefined,
          debit: isDebit ? mag : 0,
          credit: isDebit ? 0 : mag,
        };
      }),
      provenance: provenance(key, ctx),
    });
  }
  return out;
}
