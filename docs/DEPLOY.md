# Deploying the Office Hours console to Vercel

The console is Vercel-ready: a static page (`apps/console/public`) plus three serverless functions (`api/skills`, `api/models`, `api/run`) that run the real CFO chain. `vercel.json` already carries the build settings, so there is **nothing to configure** — the only step that can't be automated is authenticating to *your* Vercel account.

The build is pre-verified: `npm run vercel:check` bundles all three functions with esbuild (the exact bundler Vercel uses) and runs the output, so the remote build is known-good before you deploy.

## Option A — connect the repo (recommended; durable URL, auto-redeploys)

1. Go to <https://vercel.com/new>.
2. Import **`bcdguru/finance-workbench`** (authorize the GitHub account if prompted; the repo is private).
3. Leave every setting at its default — `vercel.json` configures the build — and click **Deploy**.
4. You get a stable `https://<project>.vercel.app` URL. Every push to `main` redeploys automatically.

## Option B — Vercel CLI

```bash
npm i -g vercel
cd <repo>
vercel login          # interactive (browser)
vercel --prod         # accept the defaults; prints the URL
```

## What's deployed

- The deployed link runs **scripted providers only** — by design, since there are no API keys on a public URL. It demonstrates the chain and the live LLM-routing story (switch the model, re-run, watch GREEN/PROCEED become ORANGE/REWORK on the same deal).
- To enable a **live** model on the deployment: set `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) in the Vercel project's Environment Variables, then add the matching live option in `api/models.ts` and route to it in `api/run.ts`.

## Local equivalent

```bash
npm run console      # http://localhost:4173 — same page, same chain code
```
