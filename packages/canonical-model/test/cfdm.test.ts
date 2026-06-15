import test from "node:test";
import assert from "node:assert/strict";

import {
  CFDM_VERSION,
  CFDM_ENTITY_KINDS,
  Provenance,
  Account,
  CostCenter,
  TrialBalanceLine,
  JournalEntry,
} from "../src/index.js";

const prov = {
  source_system: "sap-fi",
  source_object_id: "0000400000",
  extracted_at: "2026-06-15T00:00:00.000Z",
  transform_version: "sap-fi@0.1.0/cfdm@0.1.0",
};

test("CFDM exposes a version and the expected entity kinds", () => {
  assert.equal(CFDM_VERSION, "0.1.0");
  for (const k of ["Account", "JournalEntry", "TrialBalanceLine", "CostCenter"]) {
    assert.ok(CFDM_ENTITY_KINDS.includes(k as any), `${k} missing from CFDM_ENTITY_KINDS`);
  }
});

test("provenance requires all four trace fields and an ISO timestamp", () => {
  assert.ok(Provenance.safeParse(prov).success);
  assert.ok(!Provenance.safeParse({ ...prov, source_system: "" }).success);
  assert.ok(!Provenance.safeParse({ ...prov, extracted_at: "not-a-date" }).success);
  const { extracted_at, ...missing } = prov;
  assert.ok(!Provenance.safeParse(missing).success);
});

test("Account validates and rejects an unknown account type", () => {
  const ok = Account.safeParse({ account_id: "1", ledger_id: "0L", number: "0000400000", name: "Revenue", type: "revenue", provenance: prov });
  assert.ok(ok.success);
  assert.ok(!Account.safeParse({ account_id: "1", ledger_id: "0L", number: "x", name: "y", type: "income", provenance: prov }).success);
});

test("every CFDM entity requires provenance", () => {
  assert.ok(!Account.safeParse({ account_id: "1", ledger_id: "0L", number: "x", name: "y", type: "asset" }).success);
  assert.ok(!TrialBalanceLine.safeParse({ ledger_id: "0L", account_id: "1", period: "2026-05", debit: 0, credit: 0, balance: 0 }).success);
});

test("CostCenter defaults active to true and keeps responsible optional", () => {
  const cc = CostCenter.parse({ cost_center_id: "CC-1", name: "Ops", provenance: prov });
  assert.equal(cc.active, true);
  assert.equal(cc.responsible, undefined);
});

test("JournalEntry validates nested lines with debit/credit defaults", () => {
  const je = JournalEntry.parse({
    journal_id: "1000/2026/1",
    ledger_id: "0L",
    posted_at: "2026-05-15T00:00:00.000Z",
    lines: [{ account_id: "0000500000", debit: 100 }],
    provenance: prov,
  });
  assert.equal(je.lines[0]!.credit, 0); // defaulted
  assert.ok(!JournalEntry.safeParse({ journal_id: "x", ledger_id: "0L", posted_at: "2026-05-15T00:00:00.000Z", lines: [{ account_id: "a", debit: -5 }], provenance: prov }).success); // negative debit
});
