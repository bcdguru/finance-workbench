// Bundles skills/<name>/{skill.json,SKILL.md} into a single JSON the Vercel
// serverless functions import statically (no filesystem reads at runtime).
// Run by the Vercel buildCommand and by the console function test.
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(repoRoot, "skills");
const outFile = join(repoRoot, "apps", "console", "skills.bundle.json");

const bundle = [];
for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const metaPath = join(skillsDir, entry.name, "skill.json");
  if (!existsSync(metaPath)) continue;
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  const promptPath = join(skillsDir, entry.name, "SKILL.md");
  const prompt = existsSync(promptPath) ? readFileSync(promptPath, "utf8") : "";
  bundle.push({ ...meta, prompt });
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(bundle, null, 2));
console.log(`Wrote ${bundle.length} skills to ${outFile}`);
