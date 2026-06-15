import test from "node:test";
import assert from "node:assert/strict";

import { buildFpaModel } from "../src/workbenches/fpa-model.ts";
import type { CfdmDataset } from "../src/cfdm/types.ts";

const prov = (id: string) => ({ source_system: "sap-fi", source_object_id: id, extracted_at: "2026-06-15T00:00:00.000Z", transform_version: "sap-fi@0.1.0/cfdm@0.1.0" });

const data: CfdmDataset = {
  generatedAt: "2026-06-15T00:00:00Z",
  source: "SAP FI/CO (fixture)",
  cfdmVersion: "0.1.0",
  tenant: "t1",
  accounts: [
    { account_id: "A1", ledger_id: "0L", number: "A1", name: "Cash", type: "asset", provenance: prov("A1") },
    { account_id: "R1", ledger_id: "0L", number: "R1", name: "Revenue", type: "revenue", provenance: prov("R1") },
    { account_id: "E1", ledger_id: "0L", number: "E1", name: "Freight", type: "expense", provenance: prov("E1") },
  ],
  costCenters: [],
  trialBalance: [
    { ledger_id: "0L", account_id: "A1", period: "2026-04", debit: 1000, credit: 0, balance: 1000, provenance: prov("A1/04") },
    { ledger_id: "0L", account_id: "E1", period: "2026-04", debit: 300, credit: 0, balance: 300, provenance: prov("E1/04") },
    { ledger_id: "0L", account_id: "R1", period: "2026-04", debit: 0, credit: 1900, balance: -1900, provenance: prov("R1/04") },
    { ledger_id: "0L", account_id: "A1", period: "2026-05", debit: 1050, credit: 0, balance: 1050, provenance: prov("A1/05") }, // +5% (no review)
    { ledger_id: "0L", account_id: "E1", period: "2026-05", debit: 410, credit: 0, balance: 410, provenance: prov("E1/05") }, // +36.7% (review)
    { ledger_id: "0L", account_id: "R1", period: "2026-05", debit: 0, credit: 2350, balance: -2350, provenance: prov("R1/05") },
  ],
  journals: [],
};

test("buildFpaModel picks the latest period and the prior one", () => {
  const m = buildFpaModel(data);
  assert.equal(m.current, "2026-05");
  assert.equal(m.prior, "2026-04");
  assert.equal(m.curTB.length, 3);
});

test("flux deltas and percentages are computed against the prior period", () => {
  const m = buildFpaModel(data);
  const cash = m.flux.find((f) => f.line.account_id === "A1")!;
  assert.equal(cash.delta, 50);
  assert.equal(Math.round(cash.deltaPct * 10) / 10, 5);
  assert.equal(cash.review, false); // 5% < 10% threshold

  const freight = m.flux.find((f) => f.line.account_id === "E1")!;
  assert.equal(freight.delta, 110);
  assert.equal(freight.review, true); // ~36.7% >= 10%
});

test("items-to-review counts only accounts breaching the threshold", () => {
  const m = buildFpaModel(data);
  assert.equal(m.toReview, m.flux.filter((f) => f.review).length);
  assert.equal(m.toReview, 2); // freight + revenue both move > 10%
});

test("KPIs aggregate by CFDM account type for the current period", () => {
  const m = buildFpaModel(data);
  assert.equal(m.kpis.totalAssets, 1050);
  assert.equal(m.kpis.revenue, 2350); // abs of revenue balance
  assert.equal(m.kpis.opex, 410);
});

test("a custom threshold changes what gets flagged", () => {
  const strict = buildFpaModel(data, 4); // 4% threshold flags the +5% cash move too
  assert.ok(strict.flux.find((f) => f.line.account_id === "A1")!.review);
});
