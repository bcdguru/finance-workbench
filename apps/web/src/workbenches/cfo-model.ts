import type { CfoDeal, CfoDealset } from "../cfo/types.ts";

/**
 * Pure CFO decision-pipeline logic — extracted from the view for unit testing.
 * Verdict tone drives chip colour; the summary drives the KPI strip, including
 * the harsh-verdict rate (PRD health metric: a chain that only ever returns the
 * green verdict is broken; the 25-50% band is healthy).
 */
export type Tone = "good" | "caution" | "reframe" | "bad" | "neutral";

const TONE: Record<string, Tone> = {
  READY_TO_REVIEW: "good", GREEN: "good", PROCEED: "good", HOLDS: "good",
  YELLOW: "caution", PROCEED_WITH_VERIFICATIONS: "caution", HOLDS_WITH_CONDITIONS: "caution",
  ORANGE: "reframe", REWORK: "reframe", WEAK: "reframe",
  RED: "bad", DO_NOT_MODEL: "bad", REJECTED: "bad", NOT_READY: "neutral",
};
export const verdictTone = (verdict: string): Tone => TONE[verdict] ?? "neutral";

export const HARSH_VERDICTS = ["ORANGE", "RED", "REWORK", "DO_NOT_MODEL", "WEAK", "REJECTED"];
export const HEALTHY_BAND = { lo: 0.25, hi: 0.5 };

/** Verdict of a given skill's artifact in a deal, if present. */
export function verdictFor(deal: CfoDeal, skill: string): string | undefined {
  return deal.artifacts.find((a) => a.skill === skill)?.verdict;
}

export interface PipelineSummary {
  total: number;
  clearedToModel: number;
  reframeOrRework: number;
  killedOrRejected: number;
  harshVerdictRate: number;
  harshRateHealthy: boolean;
}

export function summarize(dealset: CfoDealset): PipelineSummary {
  const deals = dealset.deals;
  const auditV = (d: CfoDeal) => verdictFor(d, "cfo-forensic-audit");
  const reviewV = (d: CfoDeal) => verdictFor(d, "cfo-strategic-review");

  const clearedToModel = deals.filter((d) => ["PROCEED", "PROCEED_WITH_VERIFICATIONS"].includes(auditV(d) ?? "")).length;
  const reframeOrRework = deals.filter((d) => reviewV(d) === "ORANGE" || auditV(d) === "REWORK").length;
  const killedOrRejected = deals.filter((d) => reviewV(d) === "RED" || auditV(d) === "DO_NOT_MODEL").length;

  // Recompute from the data so the metric is verifiable, not just trusted.
  const decisive = deals.flatMap((d) => d.artifacts).filter((a) => a.skill !== "cfo-office-hours");
  const harshVerdictRate = decisive.length ? decisive.filter((a) => HARSH_VERDICTS.includes(a.verdict)).length / decisive.length : 0;

  return {
    total: deals.length,
    clearedToModel,
    reframeOrRework,
    killedOrRejected,
    harshVerdictRate,
    harshRateHealthy: harshVerdictRate >= HEALTHY_BAND.lo && harshVerdictRate <= HEALTHY_BAND.hi,
  };
}
