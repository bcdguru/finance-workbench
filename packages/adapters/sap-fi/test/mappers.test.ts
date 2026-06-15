import test from "node:test";
import assert from "node:assert/strict";

import { HttpODataClient, FixtureODataClient, mapGLAccount, mapCostCenter, mapJournalEntries, type MapContext } from "../src/index.js";

const ctx: MapContext = { tenant_id: "t1", extracted_at: "2026-06-15T00:00:00.000Z" };

/* ------------------------------------------------------------------ */
/* HttpODataClient — live transport (mocked fetch)                    */
/* ------------------------------------------------------------------ */

test("HttpODataClient builds the OData query and parses v4 `value` envelope", async () => {
  let calledUrl = "";
  const fetchImpl = (async (url: any) => {
    calledUrl = String(url);
    return new Response(JSON.stringify({ value: [{ GLAccount: "1" }] }), { status: 200 });
  }) as typeof fetch;
  const client = new HttpODataClient({ baseUrl: "https://s4/odata/", token: "tok", fetchImpl });
  const page = await client.list("A_GLAccountInChartOfAccounts", { top: 100, skip: 0, since: "2026-01-01" });
  assert.equal(page.value.length, 1);
  assert.match(calledUrl, /A_GLAccountInChartOfAccounts\?/);
  assert.match(calledUrl, /%24top=100/);
  assert.match(calledUrl, /LastChangeDateTime\+gt\+2026-01-01|LastChangeDateTime%20gt%202026-01-01/);
});

test("HttpODataClient also parses the v2 `d.results` envelope", async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ d: { results: [{ GLAccount: "a" }, { GLAccount: "b" }] } }), { status: 200 })) as typeof fetch;
  const client = new HttpODataClient({ baseUrl: "https://s4", fetchImpl });
  const page = await client.list("X");
  assert.equal(page.value.length, 2);
});

test("HttpODataClient surfaces a next cursor only when a full page returns", async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ value: [{}, {}] }), { status: 200 })) as typeof fetch;
  const client = new HttpODataClient({ baseUrl: "https://s4", fetchImpl });
  const full = await client.list("X", { top: 2, skip: 0 });
  assert.equal(full.nextSkip, 2); // page filled -> more may exist
  const fetchImpl2 = (async () => new Response(JSON.stringify({ value: [{}] }), { status: 200 })) as typeof fetch;
  const partial = await new HttpODataClient({ baseUrl: "https://s4", fetchImpl: fetchImpl2 }).list("X", { top: 2, skip: 0 });
  assert.equal(partial.nextSkip, undefined); // short page -> done
});

test("HttpODataClient throws on a non-2xx and ping reflects metadata reachability", async () => {
  const bad = new HttpODataClient({ baseUrl: "https://s4", fetchImpl: (async () => new Response("boom", { status: 503 })) as typeof fetch });
  await assert.rejects(() => bad.list("X"), /HTTP 503/);
  assert.equal(await bad.ping(), false); // 503 metadata
  const ok = new HttpODataClient({ baseUrl: "https://s4", fetchImpl: (async () => new Response("", { status: 200 })) as typeof fetch });
  assert.equal(await ok.ping(), true);
});

test("FixtureODataClient pages and applies a since filter", async () => {
  const client = new FixtureODataClient({
    X: [
      { id: 1, LastChangeDateTime: "2026-01-01" },
      { id: 2, LastChangeDateTime: "2026-06-30" },
      { id: 3, LastChangeDateTime: "2026-06-30" },
    ],
  });
  const p1 = await client.list("X", { top: 2, skip: 0 });
  assert.equal(p1.value.length, 2);
  assert.equal(p1.nextSkip, 2);
  const since = await client.list("X", { since: "2026-06-01" });
  assert.equal(since.value.length, 2);
});

/* ------------------------------------------------------------------ */
/* Mappers                                                            */
/* ------------------------------------------------------------------ */

test("GL account type codes map to CFDM account types", () => {
  assert.equal(mapGLAccount({ GLAccount: "1", GLAccountType: "X" }, ctx).type, "asset");
  assert.equal(mapGLAccount({ GLAccount: "2", GLAccountType: "L" }, ctx).type, "liability");
  assert.equal(mapGLAccount({ GLAccount: "3", GLAccountType: "Q" }, ctx).type, "equity");
  assert.equal(mapGLAccount({ GLAccount: "4", GLAccountType: "R" }, ctx).type, "revenue");
  assert.equal(mapGLAccount({ GLAccount: "5", GLAccountType: "P" }, ctx).type, "expense");
});

test("a blocked cost center maps to inactive", () => {
  assert.equal(mapCostCenter({ CostCenter: "CC-9", CostCenterName: "Old", IsBlocked: true }, ctx).active, false);
  assert.equal(mapCostCenter({ CostCenter: "CC-1", CostCenterName: "Ops", IsBlocked: false }, ctx).active, true);
});

test("journal line items group by document and respect debit/credit codes", () => {
  const rows = [
    { CompanyCode: "1000", FiscalYear: 2026, AccountingDocument: "1", GLAccount: "0000500000", DebitCreditCode: "S", AmountInCompanyCodeCurrency: 38000 },
    { CompanyCode: "1000", FiscalYear: 2026, AccountingDocument: "1", GLAccount: "0000211000", DebitCreditCode: "H", AmountInCompanyCodeCurrency: 38000 },
  ];
  const [entry] = mapJournalEntries(rows, ctx);
  assert.equal(entry!.journal_id, "1000/2026/1");
  const debit = entry!.lines.find((l) => l.debit > 0);
  const credit = entry!.lines.find((l) => l.credit > 0);
  assert.equal(debit?.account_id, "0000500000");
  assert.equal(credit?.account_id, "0000211000");
  assert.equal(debit!.debit, credit!.credit); // balanced
  assert.equal(entry!.provenance.source_system, "sap-fi");
});
