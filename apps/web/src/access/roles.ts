import type { Grant } from "@fw/access";

/**
 * Demo roles stand in for SSO-resolved grants (the role switcher in the header
 * lets you see RBAC take effect). In production these come from OIDC/SAML claims
 * mapped to entitlements; here they are fixtures.
 */
export const DEMO_ROLES: Grant[] = [
  {
    subject: "p.rao@design-partner-1.com",
    role: "Finance Director",
    personas: ["cfo", "fpa"],
    ledgers: ["*"],
    entities: ["*"],
  },
  {
    subject: "j.lee@design-partner-1.com",
    role: "FP&A Analyst",
    personas: ["fpa"],
    ledgers: ["0L"],
    entities: ["Account", "TrialBalanceLine", "JournalEntry", "CostCenter"],
  },
];
