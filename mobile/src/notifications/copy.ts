/**
 * Reminder wording.
 *
 * Rotated so the notification does not become wallpaper, and phrased as a
 * question the athlete can answer rather than a nag about a streak. The app
 * records decisions; the reminder should not moralize about them.
 */
export const REMINDER_TITLES = [
  'How did you sleep?',
  'Morning check-in',
  '20 seconds, then you know',
] as const;

export const REMINDER_BODIES = [
  'Four taps and today has a number.',
  'Tell us how the night went and we will tell you what today is good for.',
  'Check in before you decide what to train.',
] as const;

/**
 * Pick a line from its list by day, so a given day is deterministic (testable)
 * but consecutive days differ.
 */
export function reminderCopyForDay(dayIndex: number): { title: string; body: string } {
  const i = Math.abs(Math.trunc(dayIndex));
  return {
    title: REMINDER_TITLES[i % REMINDER_TITLES.length],
    body: REMINDER_BODIES[i % REMINDER_BODIES.length],
  };
}
