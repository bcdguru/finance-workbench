import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProvenancePanel } from "../src/components/ProvenancePanel.tsx";
import type { DrillTarget } from "../src/cfdm/types.ts";

const target: DrillTarget = {
  title: "Outbound freight expense · 2026-05",
  subtitle: "Trial-balance line",
  provenance: {
    source_system: "sap-fi",
    source_object_id: "0L/0000500000/20265",
    extracted_at: "2026-06-15T15:41:49.451Z",
    transform_version: "sap-fi@0.1.0/cfdm@0.1.0",
  },
};

test("ProvenancePanel renders the full source trace", () => {
  const html = renderToStaticMarkup(React.createElement(ProvenancePanel, { item: target, onClose: () => {} }));
  assert.match(html, /Trace to source/);
  assert.match(html, /Outbound freight expense/);
  assert.match(html, /0L\/0000500000\/20265/); // source object id
  assert.match(html, /sap-fi@0\.1\.0\/cfdm@0\.1\.0/); // transform version
  assert.match(html, /Open in SAP/); // deep-link affordance
});

test("ProvenancePanel renders nothing when there is no drill target", () => {
  const html = renderToStaticMarkup(React.createElement(ProvenancePanel, { item: null, onClose: () => {} }));
  assert.equal(html, "");
});
