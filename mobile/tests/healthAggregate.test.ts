import { describe, expect, it } from 'vitest';
import { dailyRestingHr, dailySleepHours, toSamples } from '@/health/aggregate';

describe('dailyRestingHr', () => {
  it('averages several readings in a day', () => {
    const out = dailyRestingHr([
      { at: '2026-08-29T06:00:00Z', bpm: 50 },
      { at: '2026-08-29T14:00:00Z', bpm: 54 },
    ]);
    expect(out.get('2026-08-29')).toBe(52);
  });

  it('keeps days separate', () => {
    const out = dailyRestingHr([
      { at: '2026-08-28T06:00:00Z', bpm: 60 },
      { at: '2026-08-29T06:00:00Z', bpm: 50 },
    ]);
    expect(out.get('2026-08-28')).toBe(60);
    expect(out.get('2026-08-29')).toBe(50);
  });

  it('rounds to a whole bpm', () => {
    const out = dailyRestingHr([
      { at: '2026-08-29T06:00:00Z', bpm: 50 },
      { at: '2026-08-29T07:00:00Z', bpm: 51 },
    ]);
    expect(out.get('2026-08-29')).toBe(51);
  });

  it('skips non-numeric readings rather than poisoning the mean', () => {
    const out = dailyRestingHr([
      { at: '2026-08-29T06:00:00Z', bpm: 50 },
      { at: '2026-08-29T07:00:00Z', bpm: NaN },
    ]);
    expect(out.get('2026-08-29')).toBe(50);
  });

  it('returns nothing for no readings', () => {
    expect(dailyRestingHr([]).size).toBe(0);
  });
});

describe('dailySleepHours', () => {
  it('attributes a night to the morning the athlete woke up', () => {
    // Asleep 23:00 Friday, awake 07:00 Saturday: this is Saturday's sleep.
    const out = dailySleepHours([
      { start: '2026-08-28T23:00:00Z', end: '2026-08-29T07:00:00Z' },
    ]);
    expect(out.get('2026-08-29')).toBe(8);
    expect(out.has('2026-08-28')).toBe(false);
  });

  it('sums interrupted sleep within one night', () => {
    const out = dailySleepHours([
      { start: '2026-08-28T23:00:00Z', end: '2026-08-29T03:00:00Z' },
      { start: '2026-08-29T03:30:00Z', end: '2026-08-29T07:00:00Z' },
    ]);
    expect(out.get('2026-08-29')).toBe(7.5);
  });

  it('rounds to one decimal', () => {
    const out = dailySleepHours([
      { start: '2026-08-29T00:00:00Z', end: '2026-08-29T07:20:00Z' },
    ]);
    expect(out.get('2026-08-29')).toBe(7.3);
  });

  it('discards a period that ends before it starts', () => {
    const out = dailySleepHours([
      { start: '2026-08-29T07:00:00Z', end: '2026-08-29T01:00:00Z' },
    ]);
    expect(out.size).toBe(0);
  });

  it('discards an unparseable period', () => {
    expect(dailySleepHours([{ start: 'nonsense', end: 'also nonsense' }]).size).toBe(0);
  });

  it('discards a zero-length period', () => {
    const out = dailySleepHours([
      { start: '2026-08-29T07:00:00Z', end: '2026-08-29T07:00:00Z' },
    ]);
    expect(out.size).toBe(0);
  });
});

describe('toSamples', () => {
  it('merges both maps into ascending daily samples', () => {
    const samples = toSamples(
      new Map([
        ['2026-08-29', 7.5],
        ['2026-08-27', 8],
      ]),
      new Map([['2026-08-28', 52]]),
    );
    expect(samples.map((s) => s.date)).toEqual(['2026-08-27', '2026-08-28', '2026-08-29']);
    expect(samples[0]).toEqual({ date: '2026-08-27', sleepHours: 8, restingHr: undefined });
    expect(samples[1]).toEqual({ date: '2026-08-28', sleepHours: undefined, restingHr: 52 });
  });

  it('returns nothing when both maps are empty', () => {
    expect(toSamples(new Map(), new Map())).toEqual([]);
  });
});
