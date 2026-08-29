/**
 * Readiness scoring.
 *
 * Each signal is normalized to 0..1 (1 = ideal), then combined as a weighted
 * mean. Missing signals are dropped and the remaining weights renormalized, so a
 * partial check-in still produces an honest score — with `confidence` reporting
 * how much of the model actually had data behind it.
 */
import type {
  Band,
  CheckIn,
  DayISO,
  Intensity,
  Readiness,
  SignalContribution,
  SignalKey,
  Session,
} from './types';
import { summarizeLoad, type LoadSummary } from './load';
import { daysBetween } from './dates';
import {
  ENERGY_WORDS,
  SLEEP_QUALITY_WORDS,
  SORENESS_WORDS,
  wordFor,
} from './scales';

export const WEIGHTS: Record<SignalKey, number> = {
  sleepHours: 3,
  soreness: 3,
  load: 3,
  sleepQuality: 2,
  energy: 2,
  restingHr: 2,
};

/** Below this, a signal is called out as a limiter. */
const LIMITER_THRESHOLD = 0.6;

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Linear ramp: `at0` maps to 0, `at1` maps to 1, clamped outside. */
function ramp(value: number, at0: number, at1: number): number {
  return clamp01((value - at0) / (at1 - at0));
}

/**
 * Sleep duration. Ramps in from 4h, ideal across 7.5-9h, and declines gently
 * past 9.5h — long sleep is a mild signal of accumulated fatigue, not a fault.
 */
export function scoreSleepHours(h: number): number {
  if (h < 7.5) return ramp(h, 4, 7.5);
  if (h <= 9.5) return 1;
  return clamp01(1 - (h - 9.5) / 4);
}

/** A 1..5 subjective scale where 5 is good. */
export function scoreFivePointUp(v: number): number {
  return clamp01((v - 1) / 4);
}

/** A 1..5 subjective scale where 5 is bad (soreness). */
export function scoreFivePointDown(v: number): number {
  return clamp01((5 - v) / 4);
}

/**
 * Resting HR against the athlete's own baseline. At or below baseline is ideal;
 * +10 bpm or more is a strong fatigue/illness signal.
 */
export function scoreRestingHr(hr: number, baseline: number): number {
  return clamp01(1 - (hr - baseline) / 10);
}

/**
 * Training load. A low acute:chronic ratio means fresh, which is not a readiness
 * problem — only ratios above ~1.3 (ramping faster than conditioning) count
 * against the score, falling to zero by 2.0.
 */
export function scoreAcwr(acwr: number): number {
  if (acwr <= 1.3) return 1;
  return clamp01(1 - (acwr - 1.3) / 0.7);
}

/** Median resting HR over trailing days, used as the personal baseline. */
export function restingHrBaseline(
  checkIns: CheckIn[],
  asOf: DayISO,
  windowDays = 28,
  minSamples = 5,
): number | undefined {
  const values = checkIns
    .filter((c) => {
      const age = daysBetween(c.date, asOf);
      return age > 0 && age <= windowDays && typeof c.restingHr === 'number';
    })
    .map((c) => c.restingHr as number)
    .sort((a, b) => a - b);

  if (values.length < minSamples) return undefined;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
}

/** "7h 30m" — the same wording the check-in ruler uses. */
function formatSleep(h: number): string {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function bandForScore(score: number): Band {
  if (score < 40) return 'rest';
  if (score < 60) return 'easy';
  if (score < 80) return 'moderate';
  return 'go';
}

const CEILING_BY_BAND: Record<Band, Intensity> = {
  rest: 'rest',
  easy: 'easy',
  moderate: 'moderate',
  go: 'max',
};

export function ceilingForBand(b: Band): Intensity {
  return CEILING_BY_BAND[b];
}

export interface ReadinessInput {
  date: DayISO;
  checkIn?: CheckIn;
  /** All check-ins, used for the personal resting-HR baseline. */
  history: CheckIn[];
  /** All sessions, used for training load. */
  sessions: Session[];
}

export function computeReadiness(input: ReadinessInput): Readiness {
  const { date, checkIn, history, sessions } = input;
  return computeReadinessFrom(
    date,
    checkIn,
    restingHrBaseline(history, date),
    summarizeLoad(sessions, date),
  );
}

/**
 * Score one day from already-resolved inputs.
 *
 * Both the single-day path above and the bulk replay call this, so the two
 * cannot produce different numbers for the same day.
 */
export function computeReadinessFrom(
  date: DayISO,
  checkIn: CheckIn | undefined,
  restingHrBase: number | undefined,
  load: LoadSummary,
): Readiness {
  const contributions: SignalContribution[] = [];

  const add = (
    key: SignalKey,
    label: string,
    normalized: number | undefined,
    display: string,
  ) => {
    if (normalized === undefined) return;
    contributions.push({
      key,
      label,
      normalized,
      weight: WEIGHTS[key],
      limiting: normalized < LIMITER_THRESHOLD,
      display,
    });
  };

  if (checkIn?.sleepHours !== undefined) {
    add('sleepHours', 'Sleep', scoreSleepHours(checkIn.sleepHours), formatSleep(checkIn.sleepHours));
  }
  if (checkIn?.sleepQuality !== undefined) {
    add(
      'sleepQuality',
      'Sleep quality',
      scoreFivePointUp(checkIn.sleepQuality),
      wordFor(SLEEP_QUALITY_WORDS, checkIn.sleepQuality),
    );
  }
  if (checkIn?.soreness !== undefined) {
    add(
      'soreness',
      'Soreness',
      scoreFivePointDown(checkIn.soreness),
      wordFor(SORENESS_WORDS, checkIn.soreness),
    );
  }
  if (checkIn?.energy !== undefined) {
    add('energy', 'Energy', scoreFivePointUp(checkIn.energy), wordFor(ENERGY_WORDS, checkIn.energy));
  }

  if (checkIn?.restingHr !== undefined && restingHrBase !== undefined) {
    const delta = checkIn.restingHr - restingHrBase;
    add(
      'restingHr',
      'Resting HR',
      scoreRestingHr(checkIn.restingHr, restingHrBase),
      `${checkIn.restingHr} bpm (${delta >= 0 ? '+' : ''}${delta.toFixed(0)} vs base)`,
    );
  }

  if (load.acwr !== undefined) {
    add('load', 'Training load', scoreAcwr(load.acwr), `ACWR ${load.acwr.toFixed(2)}`);
  }

  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
  const allWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

  // No data at all: a neutral score is less misleading than a zero, and the
  // confidence of 0 is what the UI keys off to ask for a check-in.
  const score =
    totalWeight === 0
      ? 50
      : Math.round(
          (contributions.reduce((sum, c) => sum + c.normalized * c.weight, 0) / totalWeight) * 100,
        );

  const band = bandForScore(score);

  return {
    date,
    score,
    band,
    recommendedCeiling: ceilingForBand(band),
    contributions,
    limiters: contributions.filter((c) => c.limiting).sort((a, b) => a.normalized - b.normalized),
    confidence: totalWeight / allWeight,
  };
}
