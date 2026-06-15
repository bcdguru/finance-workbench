import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SapFiAdapter, SAP_FI_FIXTURE } from "@fw/adapter-sap-fi";
import type { CfdmEntityKind } from "@fw/canonical-model";
import type { Connection, TenantSourceConfig } from "@fw/adapter-sdk";

/**
 * Generates the CFDM dataset the FP&A workbench renders, by running the real
 * SAP FI adapter over its fixture. This is the platform's adapter -> CFDM path
 * exercised at build time; swap the fixture for a live `baseUrl`/`token` and the
 * same workbench renders live SAP data. Run by `npm run gen:cfdm` (and build).
 */
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", "cfdm.json");

const adapter = new SapFiAdapter({ fixture: SAP_FI_FIXTURE });
const config: TenantSourceConfig = { tenant_id: "design-partner-1", source_system: "sap-fi", vault_ref: "vault://design-partner-1/sap" };

async function collect(conn: Connection, kind: CfdmEntityKind) {
  const records: unknown[] = [];
  for await (const batch of adapter.extract(conn, { kind })) records.push(...batch.records);
  return records;
}

const conn = await adapter.connect(config);
const caps = await adapter.discover(conn);

const dataset = {
  generatedAt: new Date().toISOString(),
  source: "SAP FI/CO (fixture)",
  cfdmVersion: caps.cfdm_version,
  tenant: config.tenant_id,
  accounts: await collect(conn, "Account"),
  costCenters: await collect(conn, "CostCenter"),
  trialBalance: await collect(conn, "TrialBalanceLine"),
  journals: await collect(conn, "JournalEntry"),
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(dataset, null, 2));
console.log(`Wrote CFDM dataset: ${dataset.accounts.length} accounts, ${dataset.trialBalance.length} TB lines, ${dataset.journals.length} journals -> ${out}`);
