import test from "node:test";
import assert from "node:assert/strict";

import { Account, JournalEntry, TrialBalanceLine, CostCenter, type CfdmEntityKind } from "@fw/canonical-model";
import { certify, type TenantSourceConfig } from "@fw/adapter-sdk";
import { SapFiAdapter, SAP_FI_FIXTURE } from "../src/index.js";

/**
 * Phase 1 exit gate (read-only SAP FI): the adapter serves GL accounts, cost
 * centers, trial-balance lines, and journal entries as CFDM with mandatory
 * provenance, passes the certification suite, and emits schema-valid records —
 * all against a fixture SAP source so it runs with no live system.
 */

const config: TenantSourceConfig = {
  tenant_id: "design-partner-1",
  source_system: "sap-fi",
  vault_ref: "vault://design-partner-1/sap",
};

function adapter(opts: { pageSize?: number } = {}) {
  return new SapFiAdapter({ fixture: SAP_FI_FIXTURE, pageSize: opts.pageSize });
}

async function collect(kind: CfdmEntityKind, opts: { since?: string; pageSize?: number } = {}) {
  const a = adapter({ pageSize: opts.pageSize });
  const conn = await a.connect(config);
  const records: unknown[] = [];
  let batches = 0;
  for await (const batch of a.extract(conn, { kind, since: opts.since, page_size: opts.pageSize })) {
    batches++;
    records.push(...batch.records);
  }
  return { records, batches };
}

test("adapter passes the certification suite", async () => {
  const report = await certify(adapter(), config);
  assert.equal(report.passed, true, JSON.stringify(report, null, 2));
  assert.equal(report.checks.find((c) => c.name === "healthcheck")?.passed, true);
});

test("discover advertises the Phase 1 read-only entity set", async () => {
  const a = adapter();
  const conn = await a.connect(config);
  const caps = await a.discover(conn);
  const kinds = caps.entities.map((e) => e.kind).sort();
  assert.deepEqual(kinds, ["Account", "CostCenter", "JournalEntry", "TrialBalanceLine"]);
});

test("GL accounts map to schema-valid CFDM with full provenance", async () => {
  const { records } = await collect("Account");
  assert.equal(records.length, 5);
  for (const r of records) {
    const acct = Account.parse(r); // throws if not CFDM-valid
    assert.equal(acct.provenance.source_system, "sap-fi");
    assert.match(acct.provenance.transform_version, /sap-fi@.*cfdm@/);
    assert.ok(!Number.isNaN(Date.parse(acct.provenance.extracted_at)));
    assert.ok(acct.provenance.source_object_id.length > 0);
  }
  const revenue = records.map((r) => Account.parse(r)).find((a) => a.number === "0000400000");
  assert.equal(revenue?.type, "revenue");
});

test("cost centers map, including the blocked one flagged inactive", async () => {
  const { records } = await collect("CostCenter");
  const ccs = records.map((r) => CostCenter.parse(r));
  assert.equal(ccs.length, 3);
  assert.equal(ccs.find((c) => c.cost_center_id === "CC-9000")?.active, false);
});

test("journal items are grouped into balanced CFDM entries traced to the SAP document", async () => {
  const { records } = await collect("JournalEntry");
  const entries = records.map((r) => JournalEntry.parse(r));
  assert.equal(entries.length, 2); // 4 line items -> 2 documents
  for (const e of entries) {
    const debits = e.lines.reduce((s, l) => s + l.debit, 0);
    const credits = e.lines.reduce((s, l) => s + l.credit, 0);
    assert.equal(debits, credits, `journal ${e.journal_id} should balance`);
    assert.ok(e.provenance.source_object_id.includes("/")); // CompanyCode/Year/Doc
  }
  const freight = entries.find((e) => e.journal_id.endsWith("/100000001"));
  assert.equal(freight?.lines.find((l) => l.debit > 0)?.cost_center_id, "CC-1000");
});

test("trial-balance lines validate as CFDM", async () => {
  const { records } = await collect("TrialBalanceLine");
  const lines = records.map((r) => TrialBalanceLine.parse(r));
  assert.equal(lines.length, 8); // two periods x four accounts
  assert.ok(lines.every((l) => /^\d{4}-\d{2}$/.test(l.period)));
});

test("incremental extraction respects the changed-since cursor", async () => {
  const full = await collect("TrialBalanceLine");
  const incremental = await collect("TrialBalanceLine", { since: "2026-06-01T00:00:00Z" });
  assert.equal(full.records.length, 8);
  assert.equal(incremental.records.length, 2); // only the two June-dated rows
});

test("extraction pages through the source", async () => {
  const { records, batches } = await collect("Account", { pageSize: 2 });
  assert.equal(records.length, 5);
  assert.equal(batches, 3); // 2 + 2 + 1
});

test("extracting an unsupported entity kind is refused", async () => {
  const a = adapter();
  const conn = await a.connect(config);
  await assert.rejects(async () => {
    for await (const _ of a.extract(conn, { kind: "BudgetVersion" })) { /* no-op */ }
  }, /does not serve CFDM kind "BudgetVersion"/);
});
