/**
 * Entitlements: what the free tier can see, and what the subscription unlocks.
 *
 * The gating rule follows from the product thesis. Today's number is free
 * forever — it is commodity, and charging for it invites the comparison with
 * WHOOP and Oura that we lose. What is paid is the accumulated record: the
 * override log, what those decisions cost, and the pre-session warning built
 * from them. That grows more valuable the longer someone stays, which is the
 * only durable reason to keep paying.
 */

/**
 * `coach` is a superset of `pro`, sold per athlete. A club pays for the roster
 * and, as much as anything, for a documented record of training decisions.
 */
export type Tier = 'free' | 'pro' | 'coach';

export const FREE_HISTORY_DAYS = 7;

export const FEATURES = [
  'todayScore',
  'todayLimiters',
  'logSession',
  'historyFull',
  'overrideLog',
  'outcomePatterns',
  'priorWarning',
  'weeklyNarration',
  'export',
  'roster',
] as const;

export type Feature = (typeof FEATURES)[number];

const FREE_FEATURES: ReadonlySet<Feature> = new Set<Feature>([
  'todayScore',
  'todayLimiters',
  'logSession',
]);

/** Coach-only features: everything else in the paid set comes with pro. */
const COACH_ONLY: ReadonlySet<Feature> = new Set<Feature>(['roster']);

export function hasFeature(tier: Tier, feature: Feature): boolean {
  if (FREE_FEATURES.has(feature)) return true;
  if (tier === 'coach') return true;
  return tier === 'pro' && !COACH_ONLY.has(feature);
}

/** How many days back this tier may read. Free is capped; pro is unlimited. */
export function historyLimitDays(tier: Tier): number {
  return tier === 'free' ? FREE_HISTORY_DAYS : Number.POSITIVE_INFINITY;
}

/** Copy shown on the paywall for a feature the athlete just bumped into. */
export const UPSELL_COPY: Record<Feature, string> = {
  todayScore: '',
  todayLimiters: '',
  logSession: '',
  historyFull: 'See every day you have logged, not just the last week.',
  overrideLog: 'Every time you trained through a low score — on the record.',
  outcomePatterns: 'What those sessions actually cost you, in your own numbers.',
  priorWarning: 'Get warned before the session, not after.',
  weeklyNarration: 'A plain-English read on what your week actually did.',
  export: 'Take your data with you.',
  roster: 'See your whole squad, sorted by who needs you first.',
};
