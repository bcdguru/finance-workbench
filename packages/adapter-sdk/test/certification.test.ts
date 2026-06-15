import test from "node:test";
import assert from "node:assert/strict";

import { certify, type FinanceAdapter, type TenantSourceConfig } from "../src/index.js";

const config: TenantSourceConfig = { tenant_id: "t1", source_system: "fake", vault_ref: "vault://t1/fake" };

/** A minimal conformant adapter for exercising the certification suite. */
function fakeAdapter(overrides: Partial<FinanceAdapter> = {}): FinanceAdapter {
  return {
    source_system: "fake",
    cfdm_version: "0.1.0",
    async connect() {
      return { source_system: "fake", tenant_id: "t1" };
    },
    async discover() {
      return { cfdm_version: "0.1.0", entities: [{ kind: "Account", granularity: "document", history_from: null, incremental: false }] };
    },
    async *extract() {
      yield { kind: "Account", records: [] };
    },
    async healthcheck() {
      return { healthy: true };
    },
    ...overrides,
  };
}

test("certify passes a conformant adapter and runs every check", async () => {
  const report = await certify(fakeAdapter(), config);
  assert.equal(report.passed, true);
  assert.deepEqual(
    report.checks.map((c) => c.name).sort(),
    ["connect", "declares_cfdm_version", "discover_returns_capability_matrix", "healthcheck"].sort(),
  );
});

test("certify fails when the adapter has no CFDM version", async () => {
  const report = await certify(fakeAdapter({ cfdm_version: "" }), config);
  assert.equal(report.passed, false);
  assert.equal(report.checks.find((c) => c.name === "declares_cfdm_version")?.passed, false);
});

test("certify fails (and short-circuits) when connect throws", async () => {
  const report = await certify(fakeAdapter({ connect: async () => { throw new Error("auth refused"); } }), config);
  assert.equal(report.passed, false);
  const connect = report.checks.find((c) => c.name === "connect");
  assert.equal(connect?.passed, false);
  assert.match(connect?.detail ?? "", /auth refused/);
  // short-circuits: discover/healthcheck are not run after a failed connect
  assert.equal(report.checks.find((c) => c.name === "healthcheck"), undefined);
});

test("certify fails when discover returns no entities", async () => {
  const report = await certify(fakeAdapter({ discover: async () => ({ cfdm_version: "0.1.0", entities: [] }) }), config);
  assert.equal(report.passed, false);
  assert.equal(report.checks.find((c) => c.name === "discover_returns_capability_matrix")?.passed, false);
});

test("certify fails when the source is unhealthy", async () => {
  const report = await certify(fakeAdapter({ healthcheck: async () => ({ healthy: false, detail: "down" }) }), config);
  assert.equal(report.passed, false);
  assert.equal(report.checks.find((c) => c.name === "healthcheck")?.passed, false);
});
