/**
 * Core domain types for AthletIQ.
 *
 * The app's premise: a readiness score is commodity. What is not commodity is a
 * record of the times you trained through a low score anyway, and what that
 * actually cost you. Everything here exists to make that record possible.
 */

/** ISO date, no time component: "2026-08-29". Days are the unit of everything. */
export type DayISO = string;

/** A morning check-in. Every field optional except the date — partial data is normal. */
export interface CheckIn {
  date: DayISO;
  /** Hours slept, e.g. 7.5. */
  sleepHours?: number;
  /** Subjective sleep quality, 1 (awful) to 5 (excellent). */
  sleepQuality?: number;
  /** Muscle soreness, 1 (none) to 5 (severe). Higher is worse. */
  soreness?: number;
  /** Energy / mood, 1 (flat) to 5 (great). */
  energy?: number;
  /** Resting heart rate in bpm, measured on waking. */
  restingHr?: number;
}

/** How hard a session actually was. Ordered — the numbers are compared. */
export const INTENSITIES = ['rest', 'easy', 'moderate', 'hard', 'max'] as const;
export type Intensity = (typeof INTENSITIES)[number];

/** Ordinal rank of an intensity, 0..4. Used to compare planned against actual. */
export function intensityRank(i: Intensity): number {
  return INTENSITIES.indexOf(i);
}

/** A training session the athlete logged. */
export interface Session {
  date: DayISO;
  intensity: Intensity;
  /** Duration in minutes. Drives training load alongside intensity. */
  durationMin: number;
  /** Session RPE, 1..10. If absent, derived from intensity. */
  rpe?: number;
  notes?: string;
}

/** Readiness bands, from the score. Each maps to a ceiling on recommended effort. */
export const BANDS = ['rest', 'easy', 'moderate', 'go'] as const;
export type Band = (typeof BANDS)[number];

/** One signal's contribution to the score, kept for explainability. */
export interface SignalContribution {
  key: SignalKey;
  label: string;
  /** Normalized 0..1 quality of this signal. 1 is ideal. */
  normalized: number;
  weight: number;
  /** True when the signal is dragging the score down enough to mention. */
  limiting: boolean;
  /** Human-readable current value, e.g. "5.2 h". */
  display: string;
}

export type SignalKey =
  | 'sleepHours'
  | 'sleepQuality'
  | 'soreness'
  | 'energy'
  | 'restingHr'
  | 'load';

/** The computed readiness verdict for one day. */
export interface Readiness {
  date: DayISO;
  /** 0..100. */
  score: number;
  band: Band;
  /** The hardest intensity this score endorses. */
  recommendedCeiling: Intensity;
  contributions: SignalContribution[];
  /** Signals dragging the score down, worst first. */
  limiters: SignalContribution[];
  /** How much of the weight had real data behind it, 0..1. */
  confidence: number;
}
