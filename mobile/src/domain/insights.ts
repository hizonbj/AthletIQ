/**
 * The layer the UI actually calls.
 *
 * Pulls raw records from storage, replays readiness day by day, settles the
 * override log against what followed, and applies entitlement gating in one
 * place so no screen has to remember the rules.
 */
import type { CheckIn, DayISO, Intensity, Readiness, Session } from './types';
import { computeReadiness } from './readiness';
import {
  findOverrides,
  settleOutcome,
  summarizePattern,
  warnFromHistory,
  type OverrideOutcome,
  type OverridePattern,
  type PriorWarning,
} from './override';
import { addDays, daysBetween } from './dates';
import type { Repository } from '@/data/repository';
import { hasFeature, historyLimitDays, type Tier } from '@/subscription/entitlements';

/** A value the free tier is not entitled to see. */
export interface Locked {
  locked: true;
  reason: string;
}

export type Gated<T> = T | Locked;

export function isLocked<T>(v: Gated<T>): v is Locked {
  return typeof v === 'object' && v !== null && (v as Locked).locked === true;
}

/**
 * Readiness for every day that has any data, replayed in order.
 *
 * Each day is scored using only what was known on or before it, so a past day's
 * score does not shift as new data arrives after it.
 */
export function replayReadiness(
  checkIns: CheckIn[],
  sessions: Session[],
): Map<DayISO, Readiness> {
  const days = new Set<DayISO>([...checkIns.map((c) => c.date), ...sessions.map((s) => s.date)]);
  const byDate = new Map(checkIns.map((c) => [c.date, c]));
  const out = new Map<DayISO, Readiness>();

  for (const date of [...days].sort()) {
    out.set(
      date,
      computeReadiness({
        date,
        checkIn: byDate.get(date),
        history: checkIns.filter((c) => daysBetween(c.date, date) > 0),
        sessions: sessions.filter((s) => daysBetween(s.date, date) >= 0),
      }),
    );
  }
  return out;
}

export interface TodayView {
  readiness: Readiness;
  /** True when the athlete has not checked in today. */
  needsCheckIn: boolean;
}

export interface HistoryPoint {
  date: DayISO;
  score: number;
}

export interface Insights {
  today: TodayView;
  history: HistoryPoint[];
  /** True when history was trimmed by the free-tier cap. */
  historyTruncated: boolean;
  overrides: Gated<OverrideOutcome[]>;
  pattern: Gated<OverridePattern>;
}

export async function buildInsights(
  repo: Repository,
  tier: Tier,
  today: DayISO,
): Promise<Insights> {
  const [checkIns, sessions] = await Promise.all([repo.getCheckIns(), repo.getSessions()]);
  const byDay = replayReadiness(checkIns, sessions);

  const todayCheckIn = checkIns.find((c) => c.date === today);
  const todayReadiness =
    byDay.get(today) ??
    computeReadiness({ date: today, checkIn: todayCheckIn, history: checkIns, sessions });

  const limit = historyLimitDays(tier);
  const allPoints: HistoryPoint[] = [...byDay.values()]
    .map((r) => ({ date: r.date, score: r.score }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const cutoff = Number.isFinite(limit) ? addDays(today, -(limit - 1)) : undefined;
  const history = cutoff ? allPoints.filter((p) => p.date >= cutoff) : allPoints;

  const outcomes = findOverrides(byDay, sessions).map((o) => settleOutcome(o, byDay));

  return {
    today: { readiness: todayReadiness, needsCheckIn: !todayCheckIn },
    history,
    historyTruncated: history.length < allPoints.length,
    overrides: hasFeature(tier, 'overrideLog')
      ? outcomes
      : { locked: true, reason: 'Your override log is part of AthletIQ Pro.' },
    pattern: hasFeature(tier, 'outcomePatterns')
      ? summarizePattern(outcomes)
      : { locked: true, reason: 'Outcome patterns are part of AthletIQ Pro.' },
  };
}

/**
 * The pre-session check: is this harder than today endorses, and what has that
 * cost this athlete before? Free tier is told an override is happening — that
 * much is honest — but the cost, which is the paid insight, stays locked.
 */
export async function checkBeforeSession(
  repo: Repository,
  tier: Tier,
  today: DayISO,
  proposed: Intensity,
): Promise<{ isOverride: boolean; warning: Gated<PriorWarning | undefined> }> {
  const [checkIns, sessions] = await Promise.all([repo.getCheckIns(), repo.getSessions()]);
  const byDay = replayReadiness(checkIns, sessions);
  const readiness =
    byDay.get(today) ??
    computeReadiness({
      date: today,
      checkIn: checkIns.find((c) => c.date === today),
      history: checkIns,
      sessions,
    });

  const outcomes = findOverrides(byDay, sessions).map((o) => settleOutcome(o, byDay));
  const isOverride = readiness.recommendedCeiling !== proposed && exceeds(proposed, readiness);

  if (!hasFeature(tier, 'priorWarning')) {
    return {
      isOverride,
      warning: isOverride
        ? { locked: true, reason: 'See what this has cost you before with AthletIQ Pro.' }
        : undefined,
    };
  }
  return { isOverride, warning: warnFromHistory(proposed, readiness, outcomes) };
}

function exceeds(proposed: Intensity, readiness: Readiness): boolean {
  const order: Intensity[] = ['rest', 'easy', 'moderate', 'hard', 'max'];
  return order.indexOf(proposed) > order.indexOf(readiness.recommendedCeiling);
}
