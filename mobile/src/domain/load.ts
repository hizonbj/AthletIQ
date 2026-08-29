/**
 * Training load, by the session-RPE method (Foster): load = duration x RPE.
 *
 * Acute load is the trailing 7-day sum, chronic load the trailing 28-day sum
 * scaled to a comparable week. Their ratio (ACWR) is the standard measure of how
 * much harder this week is than what the athlete is conditioned for.
 */
import type { DayISO, Intensity, Session } from './types';
import { daysBetween } from './dates';

/** Fallback RPE when the athlete logged intensity but not an explicit RPE. */
const RPE_BY_INTENSITY: Record<Intensity, number> = {
  rest: 0,
  easy: 3,
  moderate: 5,
  hard: 7,
  max: 9,
};

export function sessionLoad(s: Session): number {
  const rpe = s.rpe ?? RPE_BY_INTENSITY[s.intensity];
  return Math.max(0, s.durationMin) * rpe;
}

export interface LoadSummary {
  /** Trailing 7-day load total. */
  acute: number;
  /** Trailing 28-day load, scaled to a 7-day equivalent. */
  chronic: number;
  /** acute / chronic. Undefined until there is enough chronic history. */
  acwr?: number;
  /** Days of history available, which gates whether acwr is trustworthy. */
  daysOfHistory: number;
}

/**
 * Summarize load as of `asOf`, counting sessions in the trailing windows.
 * The current day is included: today's session counts against today's ratio.
 */
export function summarizeLoad(sessions: Session[], asOf: DayISO): LoadSummary {
  let acute = 0;
  let chronic28 = 0;
  let oldest = 0;

  for (const s of sessions) {
    const age = daysBetween(s.date, asOf);
    if (age < 0) continue; // future session, ignore
    const load = sessionLoad(s);
    if (age < 7) acute += load;
    if (age < 28) chronic28 += load;
    if (age > oldest) oldest = age;
  }

  const daysOfHistory = Math.min(oldest + 1, 28);
  const chronic = chronic28 / 4; // 28 days -> 7-day equivalent

  // Below ~14 days of history the chronic baseline is too thin to divide by:
  // a single hard session would produce a wild ratio.
  const acwr = daysOfHistory >= 14 && chronic > 0 ? acute / chronic : undefined;

  return { acute, chronic, acwr, daysOfHistory };
}
