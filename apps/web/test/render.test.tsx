import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { FpaWorkbench } from "../src/workbenches/FpaWorkbench.tsx";
import type { CfdmDataset } from "../src/cfdm/types.ts";

/**
 * Renders the FP&A workbench to markup with a CFDM dataset and asserts the
 * computed views appear (KPIs, period-over-period flux, drill-to-source tags).
 * Verifies the render path without a browser.
 */
const prov = (id: string) => ({ source_system: "sap-fi", source_object_id: id, extracted_at: "2026-06-15T00:00:00.000Z", transform_version: "sap-fi@0.1.0/cfdm@0.1.0" });

const data: CfdmDataset = {
  generatedAt: "2026-06-15T00:00:00Z",
  source: "SAP FI/CO (fixture)",
  cfdmVersion: "0.1.0",
  tenant: "design-partner-1",
  accounts: [
    { account_id: "0000400000", ledger_id: "0L", number: "0000400000", name: "Product revenue", type: "revenue", provenance: prov("0000400000") },
    { account_id: "0000500000", ledger_id: "0L", number: "0000500000", name: "Outbound freight expense", type: "expense", provenance: prov("0000500000") },
  ],
  costCenters: [],
  trialBalance: [
    { ledger_id: "0L", account_id: "0000400000", period: "2026-04", debit: 0, credit: 1900000, balance: -1900000, provenance: prov("0L/0000400000/20264") },
    { ledger_id: "0L", account_id: "0000500000", period: "2026-04", debit: 300000, credit: 0, balance: 300000, provenance: prov("0L/0000500000/20264") },
    { ledger_id: "0L", account_id: "0000400000", period: "2026-05", debit: 0, credit: 2350000, balance: -2350000, provenance: prov("0L/0000400000/20265") },
    { ledger_id: "0L", account_id: "0000500000", period: "2026-05", debit: 410000, credit: 0, balance: 410000, provenance: prov("0L/0000500000/20265") },
  ],
  journals: [
    { journal_id: "1000/2026/100000001", ledger_id: "0L", posted_at: "2026-05-15T00:00:00Z", lines: [{ account_id: "0000500000", debit: 38000, credit: 0 }, { account_id: "0000211000", debit: 0, credit: 38000 }], provenance: prov("1000/2026/100000001") },
  ],
};

test("FP&A workbench renders KPIs, flux queue, journals, and source tags", () => {
  const html = renderToStaticMarkup(React.createElement(FpaWorkbench, { data, onDrill: () => {} }));

  assert.match(html, /FP&amp;A workbench/);
  assert.match(html, /period 2026-05/);
  assert.match(html, /Items to review/);
  assert.match(html, /Flux review/);
  assert.match(html, /Product revenue/);
  assert.match(html, /Outbound freight expense/);
  assert.match(html, /sap-fi/); // drill-to-source provenance tag
  assert.match(html, /100000001/); // journal document
  // freight moved 300k -> 410k = +36.7% -> flagged Review
  assert.match(html, /Review/);
});
