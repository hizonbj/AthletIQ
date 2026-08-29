/**
 * Fast historical replay.
 *
 * The naive version re-filtered the whole check-in and session lists for every
 * day it scored, which is quadratic: at two years of daily use it took the best
 * part of a second, and it runs on every screen focus. That penalty lands
 * hardest on the users with the longest history — the ones who have been paying
 * longest and whose record is the most valuable.
 *
 * Everything here is day-indexed and precomputed once, so scoring a day is
 * constant work. `computeReadinessFrom` is shared with the single-day path, so
 * the fast and slow routes cannot drift apart.
 */
import type { CheckIn, DayISO, Readiness, Session } from './types';
import { computeReadinessFrom } from './readiness';
import { sessionLoad, type LoadSummary } from './load';
import { parseDay, toDayISO } from './dates';

const MS_PER_DAY = 86_400_000;

/** Integer day number, so windowing never re-parses a date string. */
function dayNumber(d: DayISO): number {
  return Math.round(parseDay(d) / MS_PER_DAY);
}

function dayFromNumber(n: number): DayISO {
  return toDayISO(new Date(n * MS_PER_DAY));
}

const ACUTE_DAYS = 7;
const CHRONIC_DAYS = 28;
const HR_WINDOW_DAYS = 28;
const HR_MIN_SAMPLES = 5;

export interface Replay {
  /** Readiness for every day that has any data. */
  byDay: Map<DayISO, Readiness>;
}

export function replay(checkIns: CheckIn[], sessions: Session[]): Map<DayISO, Readiness> {
  const byDay = new Map<DayISO, Readiness>();
  if (checkIns.length === 0 && sessions.length === 0) return byDay;

  const checkInDays = checkIns.map((c) => dayNumber(c.date));
  const sessionDays = sessions.map((s) => dayNumber(s.date));
  const allDays = [...checkInDays, ...sessionDays];
  const minDay = Math.min(...allDays);
  const maxDay = Math.max(...allDays);

  // The window lookbacks reach before the first day with data, so the arrays
  // are padded by the longest of them.
  const origin = minDay - CHRONIC_DAYS;
  const span = maxDay - origin + 1;

  const loadByDay = new Float64Array(span);
  const hrByDay: (number | undefined)[] = new Array(span);
  const checkInByDay: (CheckIn | undefined)[] = new Array(span);

  checkIns.forEach((c, i) => {
    const idx = checkInDays[i] - origin;
    checkInByDay[idx] = c;
    if (c.restingHr !== undefined) hrByDay[idx] = c.restingHr;
  });

  let firstSessionDay: number | undefined;
  sessions.forEach((s, i) => {
    const day = sessionDays[i];
    loadByDay[day - origin] += sessionLoad(s);
    if (firstSessionDay === undefined || day < firstSessionDay) firstSessionDay = day;
  });

  // Prefix sums make any trailing-window load total a single subtraction.
  const prefix = new Float64Array(span + 1);
  for (let i = 0; i < span; i++) prefix[i + 1] = prefix[i] + loadByDay[i];

  const windowSum = (endIdx: number, days: number): number => {
    const hi = endIdx + 1;
    const lo = Math.max(0, hi - days);
    return prefix[hi] - prefix[lo];
  };

  const daysWithData = new Set<number>([...checkInDays, ...sessionDays]);
  for (const day of [...daysWithData].sort((a, b) => a - b)) {
    const idx = day - origin;
    const date = dayFromNumber(day);

    // Load, matching summarizeLoad's windows exactly.
    const acute = windowSum(idx, ACUTE_DAYS);
    const chronic28 = windowSum(idx, CHRONIC_DAYS);
    const chronic = chronic28 / 4;
    const daysOfHistory =
      firstSessionDay === undefined || firstSessionDay > day
        ? 1
        : Math.min(day - firstSessionDay + 1, CHRONIC_DAYS);
    const load: LoadSummary = {
      acute,
      chronic,
      acwr: daysOfHistory >= 14 && chronic > 0 ? acute / chronic : undefined,
      daysOfHistory,
    };

    // Resting HR baseline over the prior 28 days, excluding the day itself.
    const window: number[] = [];
    for (let back = 1; back <= HR_WINDOW_DAYS; back++) {
      const v = hrByDay[idx - back];
      if (v !== undefined) window.push(v);
    }
    const baseline = window.length >= HR_MIN_SAMPLES ? median(window) : undefined;

    byDay.set(date, computeReadinessFrom(date, checkInByDay[idx], baseline, load));
  }

  return byDay;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
