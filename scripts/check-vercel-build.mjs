// Proves the Vercel build will succeed WITHOUT needing Vercel auth: bundles each
// serverless function with esbuild (the same bundler @vercel/node uses) and runs
// the result. Catches import-resolution issues (the .ts module import, the JSON
// skills bundle, the compiled @fw/harness) before a real deploy.
//
//   npm run vercel:check   (runs vercel:build first, then this)
import * as esbuild from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const out = mkdtempSync(join(tmpdir(), "fw-vercel-"));
try {
  for (const fn of ["skills", "models", "run", "session"]) {
    await esbuild.build({
      entryPoints: [`api/${fn}.ts`],
      bundle: true,
      platform: "node",
      format: "esm",
      external: ["@vercel/node"],
      outfile: join(out, `${fn}.mjs`),
      logLevel: "warning",
    });
  }

  const mkRes = () => ({ statusCode: 0, body: null, status(s) { this.statusCode = s; return this; }, json(d) { this.body = d; return this; } });

  // /api/run — the headless chain
  const run = (await import(pathToFileURL(join(out, "run.mjs")).href)).default;
  const runRes = mkRes();
  await run({ body: { deal: "vercel build check", modelId: "model-a" } }, runRes);
  assert.equal(runRes.statusCode, 200, "run handler did not return 200");
  assert.deepEqual(
    runRes.body.artifacts.map((a) => a.verdict),
    ["READY_TO_REVIEW", "GREEN", "PROCEED_WITH_VERIFICATIONS"],
    "chain verdicts changed unexpectedly",
  );

  // /api/session — one interactive turn
  const session = (await import(pathToFileURL(join(out, "session.mjs")).href)).default;
  const sesRes = mkRes();
  await session({ body: { deal: "vercel build check", messages: [{ role: "user", content: "hi" }] } }, sesRes);
  assert.equal(sesRes.statusCode, 200, "session handler did not return 200");
  assert.equal(sesRes.body.status, "active", "session should ask a question on the first turn");

  console.log("Vercel build check OK — esbuild bundles all 4 functions; chain (200) and session (200) run.");
} finally {
  rmSync(out, { recursive: true, force: true });
}
