/**
 * Turning raw health records into one sample per day.
 *
 * Pure, so the bucketing and averaging rules are testable without a device —
 * the platform adapters do nothing but fetch and hand their records here.
 */
import type { DayISO } from '@/domain/types';
import type { HealthSample } from './types';

/** A resting-HR reading with the instant it was taken. */
export interface HrReading {
  /** ISO instant. */
  at: string;
  bpm: number;
}

/** A sleep period. Crossing midnight is normal and handled below. */
export interface SleepPeriod {
  /** ISO instant. */
  start: string;
  /** ISO instant. */
  end: string;
}

function dayOf(instant: string): DayISO {
  return instant.slice(0, 10);
}

/**
 * Bucket resting-HR readings by day and average them. Several readings a day is
 * normal; the mean is steadier than picking one arbitrarily.
 */
export function dailyRestingHr(readings: HrReading[]): Map<DayISO, number> {
  const buckets = new Map<DayISO, number[]>();
  for (const r of readings) {
    if (!Number.isFinite(r.bpm)) continue;
    const day = dayOf(r.at);
    const list = buckets.get(day);
    if (list) list.push(r.bpm);
    else buckets.set(day, [r.bpm]);
  }

  const out = new Map<DayISO, number>();
  for (const [day, values] of buckets) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    out.set(day, Math.round(mean));
  }
  return out;
}

/**
 * Total sleep per day, attributed to the day the athlete woke up.
 *
 * A night that starts at 23:00 on Monday belongs to Tuesday's check-in — the
 * morning it is being scored against — so periods are keyed by their end.
 * Multiple periods in one night (interruptions) are summed.
 */
export function dailySleepHours(periods: SleepPeriod[]): Map<DayISO, number> {
  const buckets = new Map<DayISO, number>();
  for (const p of periods) {
    const start = Date.parse(p.start);
    const end = Date.parse(p.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const hours = (end - start) / 3_600_000;
    const day = dayOf(p.end);
    buckets.set(day, (buckets.get(day) ?? 0) + hours);
  }

  const out = new Map<DayISO, number>();
  for (const [day, hours] of buckets) {
    out.set(day, Math.round(hours * 10) / 10);
  }
  return out;
}

/** Combine the two per-day maps into the samples the merge layer consumes. */
export function toSamples(
  sleepByDay: Map<DayISO, number>,
  hrByDay: Map<DayISO, number>,
): HealthSample[] {
  const days = new Set<DayISO>([...sleepByDay.keys(), ...hrByDay.keys()]);
  return [...days]
    .sort()
    .map((date) => ({
      date,
      sleepHours: sleepByDay.get(date),
      restingHr: hrByDay.get(date),
    }));
}
