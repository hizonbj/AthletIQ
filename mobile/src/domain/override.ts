/**
 * Override detection and outcome tracking.
 *
 * This is the part of the app that no recovery score gives you. When readiness
 * says back off and the athlete trains hard anyway, that decision is recorded.
 * Days later, once there is enough data on the other side of it, we settle up:
 * what did that decision actually cost, measured against the athlete's own
 * normal rather than a population average.
 */
import type { DayISO, Intensity, Readiness, Session } from './types';
import { intensityRank } from './types';
import { addDays, daysBetween } from './dates';

/** Days after an override that we watch to judge its cost. */
export const OUTCOME_WINDOW_DAYS = 3;
/** Trailing days used to establish "normal" readiness before an override. */
export const BASELINE_WINDOW_DAYS = 14;
/** Post-override days with data required before an outcome is called settled. */
const MIN_POST_SAMPLES = 2;

export interface Override {
  date: DayISO;
  /** What readiness endorsed. */
  recommended: Intensity;
  /** What the athlete actually did. */
  actual: Intensity;
  /** How many intensity steps beyond the recommendation, >= 1. */
  magnitude: number;
  /** Readiness score on the day of the override. */
  scoreAtOverride: number;
}

export type OutcomeStatus = 'pending' | 'settled';

export interface OverrideOutcome {
  override: Override;
  status: OutcomeStatus;
  /** Median readiness over the trailing baseline window, before the override. */
  baselineScore?: number;
  /** Mean readiness across the days after the override. */
  postScore?: number;
  /**
   * baselineScore - postScore. Positive means readiness fell below the
   * athlete's own normal afterwards: the override cost them.
   */
  cost?: number;
}

/** Detect an override by comparing a session against that day's readiness. */
export function detectOverride(readiness: Readiness, session: Session): Override | undefined {
  const recommended = readiness.recommendedCeiling;
  const magnitude = intensityRank(session.intensity) - intensityRank(recommended);
  if (magnitude <= 0) return undefined;
  return {
    date: session.date,
    recommended,
    actual: session.intensity,
    magnitude,
    scoreAtOverride: readiness.score,
  };
}

/** Every override across a history of readiness scores and sessions. */
export function findOverrides(
  readinessByDay: Map<DayISO, Readiness>,
  sessions: Session[],
): Override[] {
  const out: Override[] = [];
  for (const s of sessions) {
    const r = readinessByDay.get(s.date);
    if (!r) continue;
    const o = detectOverride(r, s);
    if (o) out.push(o);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Settle one override against what followed it.
 *
 * Stays `pending` until the outcome window has enough days of data — an
 * unsettled override is shown as such rather than guessed at.
 */
export function settleOutcome(
  override: Override,
  readinessByDay: Map<DayISO, Readiness>,
): OverrideOutcome {
  const baselineScores: number[] = [];
  for (let i = 1; i <= BASELINE_WINDOW_DAYS; i++) {
    const r = readinessByDay.get(addDays(override.date, -i));
    if (r) baselineScores.push(r.score);
  }

  const postScores: number[] = [];
  for (let i = 1; i <= OUTCOME_WINDOW_DAYS; i++) {
    const r = readinessByDay.get(addDays(override.date, i));
    if (r) postScores.push(r.score);
  }

  if (baselineScores.length === 0 || postScores.length < MIN_POST_SAMPLES) {
    return { override, status: 'pending' };
  }

  const baselineScore = median(baselineScores);
  const postScore = postScores.reduce((a, b) => a + b, 0) / postScores.length;

  return {
    override,
    status: 'settled',
    baselineScore,
    postScore,
    cost: Math.round((baselineScore - postScore) * 10) / 10,
  };
}

export interface OverridePattern {
  totalOverrides: number;
  settledCount: number;
  pendingCount: number;
  /** Mean cost across settled overrides. Positive means overriding hurts you. */
  meanCost?: number;
  /** How many settled overrides ended up costing readiness. */
  costlyCount: number;
  /** The single worst settled outcome. */
  worst?: OverrideOutcome;
}

export function summarizePattern(outcomes: OverrideOutcome[]): OverridePattern {
  const settled = outcomes.filter((o) => o.status === 'settled');
  const costs = settled.map((o) => o.cost as number);

  return {
    totalOverrides: outcomes.length,
    settledCount: settled.length,
    pendingCount: outcomes.length - settled.length,
    meanCost:
      costs.length > 0
        ? Math.round((costs.reduce((a, b) => a + b, 0) / costs.length) * 10) / 10
        : undefined,
    costlyCount: costs.filter((c) => c > 0).length,
    worst:
      settled.length > 0
        ? settled.reduce((a, b) => ((a.cost as number) >= (b.cost as number) ? a : b))
        : undefined,
  };
}

export interface PriorWarning {
  /** Comparable past overrides that have settled. */
  comparableCount: number;
  meanCost: number;
  /** Plain-language line to show before the session, not after. */
  message: string;
}

/**
 * The pre-session warning: what happened the last times this athlete pushed
 * past a similar recommendation. Returns undefined when there is no comparable
 * history — silence is better than a warning built on one data point.
 */
export function warnFromHistory(
  proposed: Intensity,
  readiness: Readiness,
  outcomes: OverrideOutcome[],
  minComparable = 2,
): PriorWarning | undefined {
  const magnitude = intensityRank(proposed) - intensityRank(readiness.recommendedCeiling);
  if (magnitude <= 0) return undefined;

  const comparable = outcomes.filter(
    (o) => o.status === 'settled' && o.override.magnitude >= magnitude,
  );
  if (comparable.length < minComparable) return undefined;

  const costs = comparable.map((o) => o.cost as number);
  const meanCost = Math.round((costs.reduce((a, b) => a + b, 0) / costs.length) * 10) / 10;

  const message =
    meanCost > 0
      ? `You have pushed past a ${readiness.recommendedCeiling} day ${comparable.length} times. ` +
        `Readiness fell ${meanCost} points below your normal in the days after, on average.`
      : `You have pushed past a ${readiness.recommendedCeiling} day ${comparable.length} times. ` +
        `It has not cost you — readiness held steady afterwards.`;

  return { comparableCount: comparable.length, meanCost, message };
}
