import test from "node:test";
import assert from "node:assert/strict";

import { evaluate, scopeLedgers, AuditLog, type Grant } from "../src/index.js";

const analyst: Grant = { subject: "a@co.com", role: "FP&A Analyst", personas: ["fpa"], ledgers: ["0L"], entities: ["Account", "TrialBalanceLine"] };
const director: Grant = { subject: "d@co.com", role: "Finance Director", personas: ["cfo", "fpa"], ledgers: ["*"], entities: ["*"] };

test("evaluate allows a request fully within the grant", () => {
  const d = evaluate(analyst, { persona: "fpa", ledger: "0L", entities: ["Account", "TrialBalanceLine"] });
  assert.equal(d.allowed, true);
  assert.deepEqual(d.reasons, []);
});

test("evaluate denies a persona the user lacks, with a reason", () => {
  const d = evaluate(analyst, { persona: "cfo" });
  assert.equal(d.allowed, false);
  assert.match(d.reasons[0]!, /CFO persona/);
});

test("evaluate denies out-of-scope ledger and entities", () => {
  const d = evaluate(analyst, { persona: "fpa", ledger: "1000", entities: ["Account", "JournalEntry"] });
  assert.equal(d.allowed, false);
  assert.ok(d.reasons.some((r) => /ledger 1000/.test(r)));
  assert.ok(d.reasons.some((r) => /JournalEntry/.test(r)));
});

test("wildcard grants pass any ledger or entity", () => {
  assert.equal(evaluate(director, { persona: "cfo", ledger: "9999", entities: ["BudgetVersion"] }).allowed, true);
});

test("scopeLedgers filters rows to the granted ledgers", () => {
  const rows = [{ ledger_id: "0L" }, { ledger_id: "1000" }, { ledger_id: "0L" }];
  assert.equal(scopeLedgers(analyst, rows).length, 2);
  assert.equal(scopeLedgers(director, rows).length, 3); // wildcard
});

test("audit log appends ids + timestamps and isolates denied attempts", () => {
  const log = new AuditLog();
  log.record({ actor: "a@co.com", action: "open_workbench", resource: "fpa", allowed: true });
  const denied = log.record({ actor: "a@co.com", action: "open_workbench", resource: "cfo", allowed: false, reasons: ["requires the CFO persona grant"] });
  assert.match(denied.id, /^evt_/);
  assert.ok(denied.at);
  assert.equal(log.size, 2);
  assert.equal(log.denied().length, 1);
  assert.equal(log.denied()[0]!.resource, "cfo");
});
