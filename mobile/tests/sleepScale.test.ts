import { describe, expect, it } from 'vitest';
import {
  formatHours,
  MAX_HOURS,
  MIN_HOURS,
  offsetForValue,
  snapToTick,
  TICK_SPACING,
  TICKS,
  valueForOffset,
} from '@/ui/sleepScale';

describe('tick domain', () => {
  it('spans the plausible range in quarter hours', () => {
    expect(TICKS[0]).toBe(MIN_HOURS);
    expect(TICKS[TICKS.length - 1]).toBe(MAX_HOURS);
    expect(TICKS[1] - TICKS[0]).toBeCloseTo(0.25, 5);
  });

  it('has no floating point drift across the range', () => {
    // Naive accumulation gives values like 7.500000000000001, which would then
    // format as "7h 30m" but compare unequal. Every tick must be exact.
    for (const t of TICKS) {
      expect(Math.round(t * 100) / 100).toBe(t);
    }
    expect(TICKS).toContain(7.5);
    expect(TICKS).toContain(8);
  });
});

describe('formatHours', () => {
  it('omits minutes on a whole hour', () => {
    expect(formatHours(8)).toBe('8h');
  });

  it('shows minutes otherwise', () => {
    expect(formatHours(7.5)).toBe('7h 30m');
    expect(formatHours(6.25)).toBe('6h 15m');
    expect(formatHours(9.75)).toBe('9h 45m');
  });
});

describe('snapToTick', () => {
  it('leaves a valid tick alone', () => {
    expect(snapToTick(7.5)).toBe(7.5);
  });

  it('snaps an arbitrary value to the nearest quarter', () => {
    expect(snapToTick(7.6)).toBe(7.5);
    expect(snapToTick(7.7)).toBe(7.75);
  });

  it('clamps outside the range rather than returning undefined', () => {
    expect(snapToTick(0)).toBe(MIN_HOURS);
    expect(snapToTick(30)).toBe(MAX_HOURS);
    expect(snapToTick(-5)).toBe(MIN_HOURS);
  });
});

describe('offset and value round-trip', () => {
  it('maps a value to an offset and back unchanged', () => {
    for (const h of [3, 5.25, 7.5, 8, 11.75, 12]) {
      expect(valueForOffset(offsetForValue(h))).toBe(h);
    }
  });

  it('reads the nearest tick for an offset between two', () => {
    expect(valueForOffset(TICK_SPACING * 2 + 1)).toBe(TICKS[2]);
    expect(valueForOffset(TICK_SPACING * 2 - 1)).toBe(TICKS[2]);
  });

  it('clamps a scroll past either end instead of going out of bounds', () => {
    expect(valueForOffset(-500)).toBe(MIN_HOURS);
    expect(valueForOffset(999_999)).toBe(MAX_HOURS);
  });
});
