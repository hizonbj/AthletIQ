/** Day arithmetic on ISO date strings. UTC throughout — no timezone drift. */
import type { DayISO } from './types';

const MS_PER_DAY = 86_400_000;

export function toDayISO(d: Date): DayISO {
  return d.toISOString().slice(0, 10);
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
