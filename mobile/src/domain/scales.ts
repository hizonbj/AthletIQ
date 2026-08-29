/**
 * What the 1-5 subjective scales actually mean.
 *
 * These words live in the domain rather than the UI because they are the
 * definition of the scale, not styling: a 3 is only comparable across months,
 * and across two athletes, if it names the same thing every time. The check-in
 * collects with these words and every readout reports them back.
 */
export const SLEEP_QUALITY_WORDS = ['Terrible', 'Poor', 'OK', 'Good', 'Great'] as const;
export const SORENESS_WORDS = ['None', 'Slight', 'Noticeable', 'Sore', 'Very sore'] as const;
export const ENERGY_WORDS = ['Drained', 'Low', 'OK', 'Good', 'Flying'] as const;

export type ScaleWords = readonly [string, string, string, string, string];

/** Name a 1-5 value, tolerating an out-of-range value rather than crashing. */
export function wordFor(words: ScaleWords, value: number): string {
  const index = Math.min(5, Math.max(1, Math.round(value))) - 1;
  return words[index];
}
