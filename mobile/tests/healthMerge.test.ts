import { describe, expect, it } from 'vitest';
import {
  isPlausibleRestingHr,
  isPlausibleSleep,
  mergeHealthData,
  mergeSample,
} from '@/health/merge';
import type { CheckIn } from '@/domain/types';

const DATE = '2026-08-29';

describe('plausibility filters', () => {
  it('accepts realistic sleep and rejects tracker noise', () => {
    expect(isPlausibleSleep(7.5)).toBe(true);
    expect(isPlausibleSleep(0.5)).toBe(true);
    expect(isPlausibleSleep(16)).toBe(true);
    expect(isPlausibleSleep(0)).toBe(false);
    expect(isPlausibleSleep(23)).toBe(false);
    expect(isPlausibleSleep(NaN)).toBe(false);
  });

  it('accepts realistic resting HR and rejects the rest', () => {
    expect(isPlausibleRestingHr(52)).toBe(true);
    expect(isPlausibleRestingHr(25)).toBe(true);
    expect(isPlausibleRestingHr(120)).toBe(true);
    expect(isPlausibleRestingHr(10)).toBe(false);
    expect(isPlausibleRestingHr(190)).toBe(false);
    expect(isPlausibleRestingHr(NaN)).toBe(false);
  });
});

describe('mergeSample', () => {
  it('fills an empty day from the health store', () => {
    const merged = mergeSample(undefined, { date: DATE, sleepHours: 7.2, restingHr: 51 });
    expect(merged).toEqual({ date: DATE, sleepHours: 7.2, restingHr: 51 });
  });

  it('never overwrites what the athlete typed', () => {
    const existing: CheckIn = { date: DATE, sleepHours: 6, restingHr: 60 };
    const merged = mergeSample(existing, { date: DATE, sleepHours: 8.5, restingHr: 48 });
    expect(merged.sleepHours).toBe(6);
    expect(merged.restingHr).toBe(60);
  });

  it('fills only the field that is missing', () => {
    const existing: CheckIn = { date: DATE, sleepHours: 6 };
    const merged = mergeSample(existing, { date: DATE, sleepHours: 8.5, restingHr: 48 });
    expect(merged.sleepHours).toBe(6);
    expect(merged.restingHr).toBe(48);
  });

  it('discards an implausible imported value rather than filling with it', () => {
    const merged = mergeSample(undefined, { date: DATE, sleepHours: 22, restingHr: 200 });
    expect(merged.sleepHours).toBeUndefined();
    expect(merged.restingHr).toBeUndefined();
  });

  it('preserves subjective fields the health store knows nothing about', () => {
    const existing: CheckIn = { date: DATE, soreness: 4, energy: 2 };
    const merged = mergeSample(existing, { date: DATE, sleepHours: 7 });
    expect(merged.soreness).toBe(4);
    expect(merged.energy).toBe(2);
    expect(merged.sleepHours).toBe(7);
  });

  it('treats a zero resting HR as missing, not as a real reading', () => {
    const merged = mergeSample(undefined, { date: DATE, restingHr: 0 });
    expect(merged.restingHr).toBeUndefined();
  });
});

describe('mergeHealthData', () => {
  it('returns only the days it actually changed', () => {
    const checkIns: CheckIn[] = [
      { date: '2026-08-27', sleepHours: 8, restingHr: 50 },
      { date: '2026-08-28' },
    ];
    const result = mergeHealthData(checkIns, [
      { date: '2026-08-27', sleepHours: 7, restingHr: 55 },
      { date: '2026-08-28', sleepHours: 6.5, restingHr: 53 },
    ]);
    expect(result.updated.map((c) => c.date)).toEqual(['2026-08-28']);
    expect(result.filledCount).toBe(2);
  });

  it('creates check-ins for days that had none', () => {
    const result = mergeHealthData([], [{ date: DATE, sleepHours: 7.5 }]);
    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].sleepHours).toBe(7.5);
    expect(result.filledCount).toBe(1);
  });

  it('reports nothing to write when every value is already present', () => {
    const checkIns: CheckIn[] = [{ date: DATE, sleepHours: 8, restingHr: 50 }];
    const result = mergeHealthData(checkIns, [{ date: DATE, sleepHours: 6, restingHr: 60 }]);
    expect(result.updated).toEqual([]);
    expect(result.filledCount).toBe(0);
  });

  it('does not count an implausible value as filled', () => {
    const result = mergeHealthData([{ date: DATE }], [{ date: DATE, sleepHours: 99 }]);
    expect(result.updated).toEqual([]);
    expect(result.filledCount).toBe(0);
  });

  it('handles an empty import without touching anything', () => {
    const result = mergeHealthData([{ date: DATE, sleepHours: 8 }], []);
    expect(result.updated).toEqual([]);
    expect(result.filledCount).toBe(0);
  });
});
