import type { CfdmDataset } from "./types.ts";

/**
 * Loads the CFDM dataset. Today it reads the static dataset produced from the
 * SAP FI adapter; in production this is the CFDM Query API call. Either way the
 * workbench only ever speaks CFDM, never an adapter-specific shape.
 */
export async function loadCfdm(): Promise<CfdmDataset> {
  const res = await fetch(`${import.meta.env.BASE_URL}cfdm.json`);
  if (!res.ok) throw new Error(`failed to load CFDM dataset (${res.status})`);
  return res.json();
}

export const fmtMoney = (n: number): string =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const fmtPct = (n: number): string => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
