import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CfoWorkbench } from "../src/workbenches/CfoWorkbench.tsx";
import { ArtifactPanel } from "../src/components/ArtifactPanel.tsx";
import type { CfoDealset, CfoDeal } from "../src/cfo/types.ts";

const art = (skill: string, verdict: string, body: any = {}) => ({ skill, artifactKind: skill, verdict, modelId: "claude-fable-5", createdAt: "2026-06-15T00:00:00Z", body });

const deals: CfoDeal[] = [
  { id: "midwest", title: "Midwest DC buildout", sponsor: "VP Ops", decisionType: "Capex", amount: 84_000_000, stage: "cfo-forensic-audit", status: "Cleared to model", artifacts: [art("cfo-office-hours", "READY_TO_REVIEW", { value_thesis: { one_sentence: "Lowers outbound freight cost." } }), art("cfo-strategic-review", "GREEN"), art("cfo-forensic-audit", "PROCEED_WITH_VERIFICATIONS")] },
  { id: "erp", title: "S/4 re-platform", sponsor: "CIO", decisionType: "Strategic initiative", amount: 120_000_000, stage: "cfo-forensic-audit", status: "Sent back to rework", artifacts: [art("cfo-office-hours", "READY_TO_REVIEW"), art("cfo-strategic-review", "ORANGE"), art("cfo-forensic-audit", "REWORK")] },
];

const dealset: CfoDealset = { generatedAt: "", source: "Office Hours harness (CFO chain)", tenant: "design-partner-1", harshVerdictRate: 0.4, deals };

test("CFO workbench renders the pipeline, KPIs, and verdict chips", () => {
  const html = renderToStaticMarkup(React.createElement(CfoWorkbench, { data: dealset, onOpen: () => {} }));
  assert.match(html, /CFO workbench/);
  assert.match(html, /Decision pipeline/);
  assert.match(html, /Harsh-verdict rate/);
  assert.match(html, /Midwest DC buildout/);
  assert.match(html, /S\/4 re-platform/);
  assert.match(html, /GREEN/);
  assert.match(html, /ORANGE/);
  assert.match(html, /REWORK/);
  assert.match(html, /\$84,000,000/); // formatted amount
});

test("ArtifactPanel renders a deal's chain timeline with verdicts and JSON", () => {
  const html = renderToStaticMarkup(React.createElement(ArtifactPanel, { deal: deals[0]!, onClose: () => {} }));
  assert.match(html, /Midwest DC buildout/);
  assert.match(html, /Office hours — thesis/);
  assert.match(html, /Strategic review/);
  assert.match(html, /Forensic audit/);
  assert.match(html, /Lowers outbound freight cost/); // surfaced thesis line
  assert.match(html, /Artifact JSON/);
});

test("ArtifactPanel renders nothing without a deal", () => {
  assert.equal(renderToStaticMarkup(React.createElement(ArtifactPanel, { deal: null, onClose: () => {} })), "");
});
