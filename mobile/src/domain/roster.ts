/**
 * Coach roster.
 *
 * The same engine, pointed at a squad instead of one person. A coach does not
 * want twenty scores — they want to know who to talk to this morning, in what
 * order, and they want a record of having been told. That record is the reason
 * a club will pay per athlete: it is training decisions documented, not advice.
 */
import type { CheckIn, DayISO, Readiness, Session } from './types';
import { computeReadiness } from './readiness';
import { replayReadiness } from './insights';
import { findOverrides, settleOutcome, summarizePattern } from './override';
import { addDays, daysBetween } from './dates';

export interface Athlete {
  id: string;
  name: string;
}

export interface AthleteData {
  athlete: Athlete;
  checkIns: CheckIn[];
  sessions: Session[];
}

/**
 * Triage status. `flag` means talk to them today; `watch` means keep an eye on
 * them; `stale` means we cannot say anything because they have not checked in.
 */
export type RosterStatus = 'flag' | 'watch' | 'stale' | 'ok';

/** Days without a check-in before we stop trusting an athlete's number. */
export const STALE_AFTER_DAYS = 3;
/** Overrides within this window count toward the repeat-offender flag. */
export const OVERRIDE_WINDOW_DAYS = 30;
/** Overrides in the window that, on their own, warrant a flag. */
const REPEAT_OVERRIDE_THRESHOLD = 3;

export interface RosterEntry {
  athlete: Athlete;
  readiness: Readiness;
  status: RosterStatus;
  /** Why this athlete is flagged or watched, for the coach to read. */
  reason?: string;
  /**
   * The day the readiness above was actually measured. A coach opens this at
   * 7am before anyone has checked in, so the most recent real reading within
   * the stale window is carried forward — labelled, never passed off as today's.
   */
  readinessAsOf?: DayISO;
  /** Days between `readinessAsOf` and today. 0 means measured this morning. */
  readinessAgeDays: number;
  /** Overrides in the trailing window. */
  recentOverrides: number;
  /** Mean cost of this athlete's settled overrides, when there are any. */
  meanOverrideCost?: number;
  lastCheckIn?: DayISO;
  daysSinceCheckIn?: number;
}

export interface RosterView {
  date: DayISO;
  /** Most concerning first — this is the coach's morning worklist. */
  entries: RosterEntry[];
  flagged: number;
  watched: number;
  stale: number;
  /** Mean readiness across athletes with a usable score. Undefined if none. */
  teamAverage?: number;
}

const STATUS_ORDER: Record<RosterStatus, number> = { flag: 0, watch: 1, stale: 2, ok: 3 };

export function buildRosterEntry(data: AthleteData, today: DayISO): RosterEntry {
  const { athlete, checkIns, sessions } = data;

  const byDay = replayReadiness(checkIns, sessions);

  // Walk back from today for the most recent day that had real signals behind
  // it. Beyond the stale window we stop looking and report no reading at all.
  let readiness = computeReadiness({
    date: today,
    checkIn: checkIns.find((c) => c.date === today),
    history: checkIns,
    sessions,
  });
  let readinessAsOf: DayISO | undefined;
  for (let age = 0; age <= STALE_AFTER_DAYS; age++) {
    const candidate = age === 0 ? readiness : byDay.get(addDays(today, -age));
    if (candidate && candidate.confidence > 0) {
      readiness = candidate;
      readinessAsOf = candidate.date;
      break;
    }
  }
  const readinessAgeDays = readinessAsOf ? daysBetween(readinessAsOf, today) : Infinity;

  const lastCheckIn = checkIns
    .map((c) => c.date)
    .filter((d) => daysBetween(d, today) >= 0)
    .sort()
    .pop();
  const daysSinceCheckIn = lastCheckIn ? daysBetween(lastCheckIn, today) : undefined;

  const outcomes = findOverrides(byDay, sessions).map((o) => settleOutcome(o, byDay));
  const recent = outcomes.filter(
    (o) => daysBetween(o.override.date, today) <= OVERRIDE_WINDOW_DAYS,
  );
  const pattern = summarizePattern(outcomes);

  const { status, reason } = triage({
    readiness,
    readinessAgeDays,
    daysSinceCheckIn,
    recentOverrides: recent.length,
  });

  return {
    athlete,
    readiness,
    status,
    reason,
    readinessAsOf,
    readinessAgeDays,
    recentOverrides: recent.length,
    meanOverrideCost: pattern.meanCost,
    lastCheckIn,
    daysSinceCheckIn,
  };
}

function triage(args: {
  readiness: Readiness;
  readinessAgeDays: number;
  daysSinceCheckIn?: number;
  recentOverrides: number;
}): { status: RosterStatus; reason?: string } {
  const { readiness, readinessAgeDays, daysSinceCheckIn, recentOverrides } = args;

  // No usable data outranks everything: a score built on nothing must not read
  // as a green light to the coach.
  if (daysSinceCheckIn === undefined) {
    return { status: 'stale', reason: 'Has never checked in' };
  }
  if (!Number.isFinite(readinessAgeDays)) {
    return { status: 'stale', reason: `No check-in for ${daysSinceCheckIn} days` };
  }

  if (readiness.band === 'rest') {
    return { status: 'flag', reason: `Readiness ${readiness.score} — asking for a day off` };
  }
  if (recentOverrides >= REPEAT_OVERRIDE_THRESHOLD) {
    return {
      status: 'flag',
      reason: `${recentOverrides} overrides in the last ${OVERRIDE_WINDOW_DAYS} days`,
    };
  }
  if (readiness.band === 'easy') {
    return { status: 'watch', reason: `Readiness ${readiness.score} — keep it light` };
  }
  if (recentOverrides > 0) {
    return {
      status: 'watch',
      reason: `${recentOverrides} recent override${recentOverrides === 1 ? '' : 's'}`,
    };
  }
  return { status: 'ok' };
}

export function buildRoster(squad: AthleteData[], today: DayISO): RosterView {
  const entries = squad
    .map((d) => buildRosterEntry(d, today))
    .sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (byStatus !== 0) return byStatus;
      // Within a status, the lower score is the more urgent conversation.
      const byScore = a.readiness.score - b.readiness.score;
      if (byScore !== 0) return byScore;
      return a.athlete.name.localeCompare(b.athlete.name);
    });

  const scored = entries.filter((e) => e.status !== 'stale');
  const teamAverage =
    scored.length > 0
      ? Math.round(scored.reduce((sum, e) => sum + e.readiness.score, 0) / scored.length)
      : undefined;

  return {
    date: today,
    entries,
    flagged: entries.filter((e) => e.status === 'flag').length,
    watched: entries.filter((e) => e.status === 'watch').length,
    stale: entries.filter((e) => e.status === 'stale').length,
    teamAverage,
  };
}
