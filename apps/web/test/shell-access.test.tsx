import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Shell } from "../src/components/Shell.tsx";
import { DEMO_ROLES } from "../src/access/roles.ts";

const base = {
  children: React.createElement("main", null, "content"),
  persona: "fpa" as const,
  onPersona: () => {},
  source: "SAP FI/CO (fixture)",
  roles: DEMO_ROLES,
  auditCount: 3,
};

test("the shell locks the CFO persona for an FP&A analyst, with the reason in the title", () => {
  const html = renderToStaticMarkup(React.createElement(Shell, { ...base, grant: DEMO_ROLES[1]!, roleIndex: 1, onRole: () => {} }));
  assert.match(html, /Analyst<\/option>/); // role switcher (FP&amp;A Analyst, & escaped)
  assert.match(html, /locked/); // CFO is locked
  assert.match(html, /requires the CFO persona grant/); // denial reason surfaced as a title
  assert.match(html, /3 audited/); // audit badge
});

test("the shell offers the CFO persona to a director", () => {
  const html = renderToStaticMarkup(React.createElement(Shell, { ...base, grant: DEMO_ROLES[0]!, roleIndex: 0, onRole: () => {} }));
  assert.doesNotMatch(html, /locked/); // both built personas granted
});
