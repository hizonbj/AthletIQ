import { describe, expect, it } from 'vitest';
import { sessionLoad, summarizeLoad } from '@/domain/load';
import { addDays } from '@/domain/dates';
import type { Session } from '@/domain/types';

const TODAY = '2026-08-29';

function s(daysAgo: number, over: Partial<Session> = {}): Session {
  return {
    date: addDays(TODAY, -daysAgo),
    intensity: 'moderate',
    durationMin: 60,
    ...over,
  };
}

describe('sessionLoad', () => {
  it('multiplies duration by RPE', () => {
    expect(sessionLoad({ date: TODAY, intensity: 'hard', durationMin: 60, rpe: 8 })).toBe(480);
  });

  it('derives RPE from intensity when not given', () => {
    expect(sessionLoad({ date: TODAY, intensity: 'moderate', durationMin: 60 })).toBe(300);
    expect(sessionLoad({ date: TODAY, intensity: 'rest', durationMin: 60 })).toBe(0);
  });

  it('treats negative duration as zero rather than negative load', () => {
    expect(sessionLoad({ date: TODAY, intensity: 'hard', durationMin: -60 })).toBe(0);
  });
});

describe('summarizeLoad', () => {
  it('withholds ACWR until there is enough chronic history', () => {
    const sessions = [s(0), s(1), s(2)];
    const out = summarizeLoad(sessions, TODAY);
    expect(out.acwr).toBeUndefined();
    expect(out.acute).toBe(900);
  });

  it('computes ACWR of 1 for a steady 28-day block', () => {
    const sessions = Array.from({ length: 28 }, (_, i) => s(i));
    const out = summarizeLoad(sessions, TODAY);
    expect(out.acwr).toBeCloseTo(1, 5);
  });

  it('reports a ratio above 1 when the recent week is heavier', () => {
    const sessions = [
      ...Array.from({ length: 7 }, (_, i) => s(i, { durationMin: 120 })),
      ...Array.from({ length: 21 }, (_, i) => s(i + 7, { durationMin: 60 })),
    ];
    const out = summarizeLoad(sessions, TODAY);
    expect(out.acwr).toBeGreaterThan(1.5);
  });

  it('includes the current day in the acute window', () => {
    const out = summarizeLoad([s(0, { durationMin: 100 })], TODAY);
    expect(out.acute).toBe(500);
  });

  it('ignores sessions dated in the future', () => {
    const out = summarizeLoad([s(-3)], TODAY);
    expect(out.acute).toBe(0);
    expect(out.daysOfHistory).toBe(1);
  });

  it('excludes sessions older than the 28-day chronic window', () => {
    const out = summarizeLoad([s(40, { durationMin: 600 })], TODAY);
    expect(out.chronic).toBe(0);
  });
});
