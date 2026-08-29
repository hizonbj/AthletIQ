import { describe, expect, it } from 'vitest';
import { dailyRestingHr, dailySleepHours, toSamples } from '@/health/aggregate';

/**
 * Health records carry absolute instants, and which calendar day they belong to
 * is a local-time question. Fixtures are therefore built from local wall-clock
 * times rather than literal UTC strings, so these tests assert the same
 * behaviour in every timezone rather than encoding the machine's offset.
 */
function at(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function label(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

describe('dailyRestingHr', () => {
  it('averages several readings taken on the same local day', () => {
    const out = dailyRestingHr([
      { at: at(2026, 8, 29, 6), bpm: 50 },
      { at: at(2026, 8, 29, 14), bpm: 54 },
    ]);
    expect(out.get(label(2026, 8, 29))).toBe(52);
  });

  it('keeps separate local days apart', () => {
    const out = dailyRestingHr([
      { at: at(2026, 8, 28, 6), bpm: 60 },
      { at: at(2026, 8, 29, 6), bpm: 50 },
    ]);
    expect(out.get(label(2026, 8, 28))).toBe(60);
    expect(out.get(label(2026, 8, 29))).toBe(50);
  });

  it('rounds to a whole bpm', () => {
    const out = dailyRestingHr([
      { at: at(2026, 8, 29, 6), bpm: 50 },
      { at: at(2026, 8, 29, 7), bpm: 51 },
    ]);
    expect(out.get(label(2026, 8, 29))).toBe(51);
  });

  it('skips non-numeric readings rather than poisoning the mean', () => {
    const out = dailyRestingHr([
      { at: at(2026, 8, 29, 6), bpm: 50 },
      { at: at(2026, 8, 29, 7), bpm: NaN },
    ]);
    expect(out.get(label(2026, 8, 29))).toBe(50);
  });

  it('returns nothing for no readings', () => {
    expect(dailyRestingHr([]).size).toBe(0);
  });
});

describe('dailySleepHours', () => {
  it('attributes a night to the morning the athlete woke up', () => {
    // Asleep 23:00 Friday, awake 07:00 Saturday: this is Saturday's sleep.
    const out = dailySleepHours([
      { start: at(2026, 8, 28, 23), end: at(2026, 8, 29, 7) },
    ]);
    expect(out.get(label(2026, 8, 29))).toBe(8);
    expect(out.has(label(2026, 8, 28))).toBe(false);
  });

  it('sums interrupted sleep within one night', () => {
    const out = dailySleepHours([
      { start: at(2026, 8, 28, 23), end: at(2026, 8, 29, 3) },
      { start: at(2026, 8, 29, 3, 30), end: at(2026, 8, 29, 7) },
    ]);
    expect(out.get(label(2026, 8, 29))).toBe(7.5);
  });

  it('rounds to one decimal', () => {
    const out = dailySleepHours([
      { start: at(2026, 8, 29, 0), end: at(2026, 8, 29, 7, 20) },
    ]);
    expect(out.get(label(2026, 8, 29))).toBe(7.3);
  });

  it('discards a period that ends before it starts', () => {
    const out = dailySleepHours([
      { start: at(2026, 8, 29, 7), end: at(2026, 8, 29, 1) },
    ]);
    expect(out.size).toBe(0);
  });

  it('discards an unparseable period', () => {
    expect(dailySleepHours([{ start: 'nonsense', end: 'also nonsense' }]).size).toBe(0);
  });

  it('discards a zero-length period', () => {
    const out = dailySleepHours([
      { start: at(2026, 8, 29, 7), end: at(2026, 8, 29, 7) },
    ]);
    expect(out.size).toBe(0);
  });
});

describe('day attribution is local, not UTC', () => {
  it('files an evening reading against that evening, not the next UTC day', () => {
    // 23:30 local is the following day in UTC for any western offset. The
    // reading belongs to the evening the athlete lived through.
    const out = dailyRestingHr([{ at: at(2026, 8, 29, 23, 30), bpm: 50 }]);
    expect(out.get(label(2026, 8, 29))).toBe(50);
  });

  it('files an early-morning reading against that morning, not the previous UTC day', () => {
    // 00:30 local is the previous day in UTC for any eastern offset.
    const out = dailyRestingHr([{ at: at(2026, 8, 29, 0, 30), bpm: 50 }]);
    expect(out.get(label(2026, 8, 29))).toBe(50);
  });

  it('falls back to the leading characters for an unparseable instant', () => {
    const out = dailyRestingHr([{ at: '2026-08-29', bpm: 50 }]);
    expect(out.size).toBe(1);
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
