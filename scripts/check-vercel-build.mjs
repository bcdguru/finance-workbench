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
  for (const fn of ["skills", "models", "run"]) {
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

  const run = (await import(pathToFileURL(join(out, "run.mjs")).href)).default;
  const res = {
    statusCode: 0,
    body: null,
    status(s) { this.statusCode = s; return this; },
    json(d) { this.body = d; return this; },
  };
  await run({ body: { deal: "vercel build check", modelId: "model-a" } }, res);

  assert.equal(res.statusCode, 200, "handler did not return 200");
  assert.deepEqual(
    res.body.artifacts.map((a) => a.verdict),
    ["READY_TO_REVIEW", "GREEN", "PROCEED_WITH_VERIFICATIONS"],
    "chain verdicts changed unexpectedly",
  );
  console.log("Vercel build check OK — esbuild bundles all 3 functions and the chain runs (200).");
} finally {
  rmSync(out, { recursive: true, force: true });
}
