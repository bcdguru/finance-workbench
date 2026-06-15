import type { CfdmDataset, TrialBalanceLine } from "../cfdm/types.ts";

/**
 * Pure FP&A computation over CFDM — extracted from the view so it can be unit
 * tested without React. Produces the period-over-period flux work queue and the
 * KPIs the workbench renders.
 */
export const REVIEW_THRESHOLD_PCT = 10;

export interface FluxRow {
  line: TrialBalanceLine;
  prev: number;
  delta: number;
  deltaPct: number;
  review: boolean;
}

export interface FpaModel {
  current: string;
  prior?: string;
  curTB: TrialBalanceLine[];
  flux: FluxRow[];
  toReview: number;
  kpis: { totalAssets: number; revenue: number; opex: number };
  nameOf: (id: string) => string;
}

export function buildFpaModel(data: CfdmDataset, threshold = REVIEW_THRESHOLD_PCT): FpaModel {
  const nameOf = (id: string) => data.accounts.find((a) => a.account_id === id)?.name ?? id;
  const typeOf = (id: string) => data.accounts.find((a) => a.account_id === id)?.type;

  const periods = [...new Set(data.trialBalance.map((t) => t.period))].sort();
  const current = periods[periods.length - 1] ?? "";
  const prior = periods[periods.length - 2];
  const curTB = data.trialBalance.filter((t) => t.period === current);
  const priorTB = data.trialBalance.filter((t) => t.period === prior);
  const priorOf = (id: string) => priorTB.find((t) => t.account_id === id);

  const sumType = (t: string) => curTB.filter((l) => typeOf(l.account_id) === t).reduce((s, l) => s + l.balance, 0);

  const flux: FluxRow[] = curTB.map((line) => {
    const prev = priorOf(line.account_id)?.balance ?? 0;
    const delta = line.balance - prev;
    const deltaPct = prev !== 0 ? (delta / Math.abs(prev)) * 100 : line.balance !== 0 ? 100 : 0;
    return { line, prev, delta, deltaPct, review: Math.abs(deltaPct) >= threshold };
  });

  return {
    current,
    prior,
    curTB,
    flux,
    toReview: flux.filter((f) => f.review).length,
    kpis: { totalAssets: sumType("asset"), revenue: Math.abs(sumType("revenue")), opex: sumType("expense") },
    nameOf,
  };
}
