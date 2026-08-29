/**
 * Pure maths behind the sleep ruler: the tick domain, and the mapping between
 * a scroll offset and an hours value. Kept free of React Native imports so the
 * snapping and rounding can be unit tested.
 */
export const MIN_HOURS = 3;
export const MAX_HOURS = 12;
export const STEP_HOURS = 0.25;
export const TICK_SPACING = 14;

export const TICKS: readonly number[] = Array.from(
  { length: Math.round((MAX_HOURS - MIN_HOURS) / STEP_HOURS) + 1 },
  (_, i) => Math.round((MIN_HOURS + i * STEP_HOURS) * 100) / 100,
);

export function formatHours(h: number): string {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** Nearest valid tick, so values arriving from elsewhere land on the ruler. */
export function snapToTick(h: number): number {
  const clamped = Math.min(MAX_HOURS, Math.max(MIN_HOURS, h));
  const index = Math.round((clamped - MIN_HOURS) / STEP_HOURS);
  return TICKS[index];
}

export function offsetForValue(h: number): number {
  return TICKS.indexOf(snapToTick(h)) * TICK_SPACING;
}

export function valueForOffset(offset: number): number {
  const index = Math.round(offset / TICK_SPACING);
  return TICKS[Math.min(TICKS.length - 1, Math.max(0, index))];
}
