import test from "node:test";
import assert from "node:assert/strict";

import { personaAccess, firstAccessiblePersona, WORKBENCH_REQS } from "../src/access/access-model.ts";
import { DEMO_ROLES } from "../src/access/roles.ts";

const director = DEMO_ROLES[0]!; // CFO + FP&A, all ledgers/entities
const analyst = DEMO_ROLES[1]!; // FP&A only, ledger 0L

test("the director can open both built workbenches", () => {
  assert.equal(personaAccess(director, "cfo").allowed, true);
  assert.equal(personaAccess(director, "fpa").allowed, true);
  assert.equal(firstAccessiblePersona(director), "cfo");
});

test("the analyst is denied the CFO workbench with a reason", () => {
  assert.equal(personaAccess(analyst, "fpa").allowed, true);
  const cfo = personaAccess(analyst, "cfo");
  assert.equal(cfo.allowed, false);
  assert.match(cfo.reasons[0]!, /CFO persona/);
  assert.equal(firstAccessiblePersona(analyst), "fpa"); // lands on FP&A, not CFO
});

test("the FP&A requirement names the ledger and entities it reads", () => {
  assert.equal(WORKBENCH_REQS.fpa.ledger, "0L");
  assert.ok(WORKBENCH_REQS.fpa.entities?.includes("TrialBalanceLine"));
});
