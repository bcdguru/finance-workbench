/**
 * A small but realistic SAP FI fixture (S/4 OData shapes) so the adapter can be
 * exercised, demoed, and certified with no live SAP system. Keyed by entity set.
 */
export const SAP_FI_FIXTURE: Record<string, any[]> = {
  A_GLAccountInChartOfAccounts: [
    { GLAccount: "0000100000", GLAccountName: "Cash and cash equivalents", GLAccountType: "X", Ledger: "0L" },
    { GLAccount: "0000211000", GLAccountName: "Trade payables", GLAccountType: "L", Ledger: "0L" },
    { GLAccount: "0000300000", GLAccountName: "Common stock", GLAccountType: "Q", Ledger: "0L" },
    { GLAccount: "0000400000", GLAccountName: "Product revenue", GLAccountType: "R", Ledger: "0L" },
    { GLAccount: "0000500000", GLAccountName: "Outbound freight expense", GLAccountType: "P", Ledger: "0L" },
  ],

  A_CostCenter: [
    { CostCenter: "CC-1000", CostCenterName: "Midwest Distribution", PersonResponsible: "A. Okafor", IsBlocked: false },
    { CostCenter: "CC-2000", CostCenterName: "Corporate Finance", PersonResponsible: "R. Patel", IsBlocked: false },
    { CostCenter: "CC-9000", CostCenterName: "Decommissioned Plant", PersonResponsible: "—", IsBlocked: true },
  ],

  A_TrialBalance: [
    // Prior period (2026-04) — enables period-over-period flux review in FP&A.
    { Ledger: "0L", GLAccount: "0000100000", FiscalYear: 2026, FiscalPeriod: 4, DebitAmountInGlobalCrcy: 1500000, CreditAmountInGlobalCrcy: 0, BalanceAmountInGlobalCrcy: 1500000, LastChangeDateTime: "2026-04-30T00:00:00Z" },
    { Ledger: "0L", GLAccount: "0000211000", FiscalYear: 2026, FiscalPeriod: 4, DebitAmountInGlobalCrcy: 0, CreditAmountInGlobalCrcy: 700000, BalanceAmountInGlobalCrcy: -700000, LastChangeDateTime: "2026-04-30T00:00:00Z" },
    { Ledger: "0L", GLAccount: "0000400000", FiscalYear: 2026, FiscalPeriod: 4, DebitAmountInGlobalCrcy: 0, CreditAmountInGlobalCrcy: 1900000, BalanceAmountInGlobalCrcy: -1900000, LastChangeDateTime: "2026-04-30T00:00:00Z" },
    { Ledger: "0L", GLAccount: "0000500000", FiscalYear: 2026, FiscalPeriod: 4, DebitAmountInGlobalCrcy: 300000, CreditAmountInGlobalCrcy: 0, BalanceAmountInGlobalCrcy: 300000, LastChangeDateTime: "2026-04-30T00:00:00Z" },
    // Current period (2026-05).
    { Ledger: "0L", GLAccount: "0000100000", FiscalYear: 2026, FiscalPeriod: 5, DebitAmountInGlobalCrcy: 1820000, CreditAmountInGlobalCrcy: 0, BalanceAmountInGlobalCrcy: 1820000, LastChangeDateTime: "2026-05-31T00:00:00Z" },
    { Ledger: "0L", GLAccount: "0000211000", FiscalYear: 2026, FiscalPeriod: 5, DebitAmountInGlobalCrcy: 0, CreditAmountInGlobalCrcy: 640000, BalanceAmountInGlobalCrcy: -640000, LastChangeDateTime: "2026-05-31T00:00:00Z" },
    { Ledger: "0L", GLAccount: "0000400000", FiscalYear: 2026, FiscalPeriod: 5, DebitAmountInGlobalCrcy: 0, CreditAmountInGlobalCrcy: 2350000, BalanceAmountInGlobalCrcy: -2350000, LastChangeDateTime: "2026-06-30T00:00:00Z" },
    { Ledger: "0L", GLAccount: "0000500000", FiscalYear: 2026, FiscalPeriod: 5, DebitAmountInGlobalCrcy: 410000, CreditAmountInGlobalCrcy: 0, BalanceAmountInGlobalCrcy: 410000, LastChangeDateTime: "2026-06-30T00:00:00Z" },
  ],

  A_JournalEntryItemBasic: [
    // Document 100000001 — freight accrual (balanced)
    { CompanyCode: "1000", FiscalYear: 2026, AccountingDocument: "100000001", Ledger: "0L", PostingDate: "2026-05-15T00:00:00Z", GLAccount: "0000500000", CostCenter: "CC-1000", DebitCreditCode: "S", AmountInCompanyCodeCurrency: 38000, LastChangeDateTime: "2026-05-15T00:00:00Z" },
    { CompanyCode: "1000", FiscalYear: 2026, AccountingDocument: "100000001", Ledger: "0L", PostingDate: "2026-05-15T00:00:00Z", GLAccount: "0000211000", DebitCreditCode: "H", AmountInCompanyCodeCurrency: 38000, LastChangeDateTime: "2026-05-15T00:00:00Z" },
    // Document 100000002 — revenue recognition (balanced)
    { CompanyCode: "1000", FiscalYear: 2026, AccountingDocument: "100000002", Ledger: "0L", PostingDate: "2026-05-20T00:00:00Z", GLAccount: "0000100000", DebitCreditCode: "S", AmountInCompanyCodeCurrency: 120000, LastChangeDateTime: "2026-05-20T00:00:00Z" },
    { CompanyCode: "1000", FiscalYear: 2026, AccountingDocument: "100000002", Ledger: "0L", PostingDate: "2026-05-20T00:00:00Z", GLAccount: "0000400000", DebitCreditCode: "H", AmountInCompanyCodeCurrency: 120000, LastChangeDateTime: "2026-05-20T00:00:00Z" },
  ],
};
