/**
 * Day arithmetic on ISO date strings.
 *
 * A DayISO is a *calendar day label*, not an instant. Arithmetic on labels runs
 * through UTC midnight so it is stable and free of DST drift, but deciding
 * which day an instant falls on must use the athlete's local calendar — a
 * session logged at 11:30pm in Los Angeles belongs to that evening, not to the
 * following day in UTC.
 */
import type { DayISO } from './types';

const MS_PER_DAY = 86_400_000;

/**
 * Format an instant as a day label in UTC.
 *
 * Correct for label arithmetic (which operates on UTC midnights) and wrong for
 * "what day is it for this person" — use `localDayISO` for that.
 */
export function toDayISO(d: Date): DayISO {
  return d.toISOString().slice(0, 10);
}

/** The calendar day an instant falls on, in the device's own timezone. */
export function localDayISO(d: Date = new Date()): DayISO {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDay(d: DayISO): number {
  const ms = Date.parse(`${d}T00:00:00.000Z`);
  if (Number.isNaN(ms)) throw new Error(`Invalid DayISO: ${d}`);
  return ms;
}

/** Whole days from `from` to `to`. Positive when `to` is later. */
export function daysBetween(from: DayISO, to: DayISO): number {
  return Math.round((parseDay(to) - parseDay(from)) / MS_PER_DAY);
}

export function addDays(d: DayISO, n: number): DayISO {
  return toDayISO(new Date(parseDay(d) + n * MS_PER_DAY));
}

/** Inclusive range of days, ascending. */
export function dayRange(from: DayISO, to: DayISO): DayISO[] {
  const out: DayISO[] = [];
  for (let i = 0; i <= daysBetween(from, to); i++) out.push(addDays(from, i));
  return out;
}
