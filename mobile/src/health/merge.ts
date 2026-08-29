/**
 * Merging imported health data into check-ins.
 *
 * One rule governs all of this: what the athlete typed wins. An imported value
 * only ever fills a gap. Sleep trackers are wrong often enough — a phone left
 * on a nightstand, a watch on the charger — that silently overwriting someone's
 * own account of their night would make readiness less trustworthy, not more,
 * and readiness is what everything else is built on.
 */
import type { CheckIn, DayISO } from '@/domain/types';
import type { HealthSample } from './types';

/** Sleep readings outside this range are tracker error, not data. */
const MIN_PLAUSIBLE_SLEEP_HOURS = 0.5;
const MAX_PLAUSIBLE_SLEEP_HOURS = 16;
/** Resting HR outside this range is not a resting measurement. */
const MIN_PLAUSIBLE_RESTING_HR = 25;
const MAX_PLAUSIBLE_RESTING_HR = 120;

export function isPlausibleSleep(h: number): boolean {
  return Number.isFinite(h) && h >= MIN_PLAUSIBLE_SLEEP_HOURS && h <= MAX_PLAUSIBLE_SLEEP_HOURS;
}

export function isPlausibleRestingHr(hr: number): boolean {
  return Number.isFinite(hr) && hr >= MIN_PLAUSIBLE_RESTING_HR && hr <= MAX_PLAUSIBLE_RESTING_HR;
}

/**
 * Fill gaps in one check-in from a health sample. Values the athlete already
 * entered are left alone, and implausible readings are discarded.
 */
export function mergeSample(existing: CheckIn | undefined, sample: HealthSample): CheckIn {
  const base: CheckIn = existing ?? { date: sample.date };

  const sleepHours =
    base.sleepHours === undefined &&
    sample.sleepHours !== undefined &&
    isPlausibleSleep(sample.sleepHours)
      ? sample.sleepHours
      : base.sleepHours;

  const restingHr =
    base.restingHr === undefined &&
    sample.restingHr !== undefined &&
    isPlausibleRestingHr(sample.restingHr)
      ? sample.restingHr
      : base.restingHr;

  return { ...base, sleepHours, restingHr };
}

export interface MergeResult {
  /** Check-ins that changed and should be written back. Unchanged days omitted. */
  updated: CheckIn[];
  /** How many individual values were filled in. */
  filledCount: number;
}

/** Merge a batch of samples into existing check-ins, keyed by date. */
export function mergeHealthData(checkIns: CheckIn[], samples: HealthSample[]): MergeResult {
  const byDate = new Map<DayISO, CheckIn>(checkIns.map((c) => [c.date, c]));
  const updated: CheckIn[] = [];
  let filledCount = 0;

  for (const sample of samples) {
    const existing = byDate.get(sample.date);
    const merged = mergeSample(existing, sample);

    let filled = 0;
    if (merged.sleepHours !== existing?.sleepHours) filled++;
    if (merged.restingHr !== existing?.restingHr) filled++;
    if (filled === 0) continue;

    filledCount += filled;
    updated.push(merged);
  }

  return { updated, filledCount };
}
