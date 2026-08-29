import { describe, expect, it } from 'vitest';
import {
  detectOverride,
  findOverrides,
  settleOutcome,
  summarizePattern,
  warnFromHistory,
  type OverrideOutcome,
} from '@/domain/override';
import { addDays } from '@/domain/dates';
import type { DayISO, Intensity, Readiness, Session } from '@/domain/types';
import { bandForScore, ceilingForBand } from '@/domain/readiness';

/** Minimal readiness stub — only the fields the override engine reads. */
function readiness(date: DayISO, score: number): Readiness {
  const band = bandForScore(score);
  return {
    date,
    score,
    band,
    recommendedCeiling: ceilingForBand(band),
    contributions: [],
    limiters: [],
    confidence: 1,
  };
}

function session(date: DayISO, intensity: Intensity): Session {
  return { date, intensity, durationMin: 60 };
}

describe('detectOverride', () => {
  it('flags training harder than readiness endorses', () => {
    const o = detectOverride(readiness('2026-08-29', 30), session('2026-08-29', 'hard'));
    expect(o).toBeDefined();
    expect(o?.recommended).toBe('rest');
    expect(o?.actual).toBe('hard');
    expect(o?.magnitude).toBe(3);
    expect(o?.scoreAtOverride).toBe(30);
  });

  it('is silent when the session obeys the recommendation', () => {
    expect(detectOverride(readiness('2026-08-29', 30), session('2026-08-29', 'rest'))).toBeUndefined();
  });

  it('is silent when the athlete trains easier than endorsed', () => {
    expect(detectOverride(readiness('2026-08-29', 95), session('2026-08-29', 'easy'))).toBeUndefined();
  });

  it('never flags anything on a high-readiness day, even a max session', () => {
    expect(detectOverride(readiness('2026-08-29', 90), session('2026-08-29', 'max'))).toBeUndefined();
  });
});

describe('findOverrides', () => {
  it('collects overrides in date order and skips days without readiness', () => {
    const map = new Map([
      ['2026-08-20', readiness('2026-08-20', 30)],
      ['2026-08-22', readiness('2026-08-22', 30)],
    ]);
    const sessions = [
      session('2026-08-22', 'max'),
      session('2026-08-20', 'hard'),
      session('2026-08-21', 'max'), // no readiness for this day
    ];
    const found = findOverrides(map, sessions);
    expect(found.map((o) => o.date)).toEqual(['2026-08-20', '2026-08-22']);
  });
});

describe('settleOutcome', () => {
  const day = '2026-08-15';

  function historyMap(baseline: number, post: number[]): Map<DayISO, Readiness> {
    const map = new Map<DayISO, Readiness>();
    for (let i = 1; i <= 14; i++) {
      const d = addDays(day, -i);
      map.set(d, readiness(d, baseline));
    }
    post.forEach((score, idx) => {
      const d = addDays(day, idx + 1);
      map.set(d, readiness(d, score));
    });
    return map;
  }

  const override = {
    date: day,
    recommended: 'rest' as Intensity,
    actual: 'hard' as Intensity,
    magnitude: 3,
    scoreAtOverride: 30,
  };

  it('stays pending without enough days on the other side', () => {
    const out = settleOutcome(override, historyMap(80, [70]));
    expect(out.status).toBe('pending');
    expect(out.cost).toBeUndefined();
  });

  it('stays pending when there is no baseline history', () => {
    const map = new Map<DayISO, Readiness>();
    [1, 2, 3].forEach((i) => map.set(addDays(day, i), readiness(addDays(day, i), 60)));
    expect(settleOutcome(override, map).status).toBe('pending');
  });

  it('settles with a positive cost when readiness fell afterwards', () => {
    const out = settleOutcome(override, historyMap(80, [60, 62, 64]));
    expect(out.status).toBe('settled');
    expect(out.baselineScore).toBe(80);
    expect(out.postScore).toBeCloseTo(62, 5);
    expect(out.cost).toBe(18);
  });

  it('settles with a negative cost when the athlete came back stronger', () => {
    const out = settleOutcome(override, historyMap(60, [70, 74, 78]));
    expect(out.status).toBe('settled');
    expect(out.cost).toBe(-14);
  });
});

describe('summarizePattern', () => {
  function settled(cost: number): OverrideOutcome {
    return {
      override: {
        date: '2026-08-01',
        recommended: 'rest',
        actual: 'hard',
        magnitude: 3,
        scoreAtOverride: 30,
      },
      status: 'settled',
      baselineScore: 80,
      postScore: 80 - cost,
      cost,
    };
  }

  const pending: OverrideOutcome = {
    override: {
      date: '2026-08-28',
      recommended: 'easy',
      actual: 'hard',
      magnitude: 2,
      scoreAtOverride: 45,
    },
    status: 'pending',
  };

  it('separates settled from pending and averages only settled costs', () => {
    const p = summarizePattern([settled(10), settled(20), pending]);
    expect(p.totalOverrides).toBe(3);
    expect(p.settledCount).toBe(2);
    expect(p.pendingCount).toBe(1);
    expect(p.meanCost).toBe(15);
    expect(p.costlyCount).toBe(2);
    expect(p.worst?.cost).toBe(20);
  });

  it('does not count a beneficial override as costly', () => {
    const p = summarizePattern([settled(-5), settled(15)]);
    expect(p.costlyCount).toBe(1);
    expect(p.meanCost).toBe(5);
  });

  it('handles an empty history without inventing a mean', () => {
    const p = summarizePattern([]);
    expect(p.totalOverrides).toBe(0);
    expect(p.meanCost).toBeUndefined();
    expect(p.worst).toBeUndefined();
  });

  it('reports no mean when every override is still pending', () => {
    const p = summarizePattern([pending, pending]);
    expect(p.meanCost).toBeUndefined();
    expect(p.settledCount).toBe(0);
  });
});

describe('warnFromHistory', () => {
  function settled(cost: number, magnitude: number): OverrideOutcome {
    return {
      override: {
        date: '2026-08-01',
        recommended: 'rest',
        actual: 'hard',
        magnitude,
        scoreAtOverride: 30,
      },
      status: 'settled',
      baselineScore: 80,
      postScore: 80 - cost,
      cost,
    };
  }

  const lowDay = readiness('2026-08-29', 30); // ceiling: rest

  it('says nothing when the proposed session is within the recommendation', () => {
    expect(warnFromHistory('rest', lowDay, [settled(10, 3), settled(12, 3)])).toBeUndefined();
  });

  it('stays silent below the minimum comparable count', () => {
    expect(warnFromHistory('hard', lowDay, [settled(10, 3)])).toBeUndefined();
  });

  it('ignores pending outcomes when counting comparables', () => {
    const pending: OverrideOutcome = { override: settled(10, 3).override, status: 'pending' };
    expect(warnFromHistory('hard', lowDay, [settled(10, 3), pending])).toBeUndefined();
  });

  it('warns with the average cost once there is comparable history', () => {
    const w = warnFromHistory('hard', lowDay, [settled(10, 3), settled(20, 3)]);
    expect(w).toBeDefined();
    expect(w?.comparableCount).toBe(2);
    expect(w?.meanCost).toBe(15);
    expect(w?.message).toContain('2 times');
    expect(w?.message).toContain('15 points');
  });

  it('reports honestly when overriding has not cost this athlete anything', () => {
    const w = warnFromHistory('hard', lowDay, [settled(-5, 3), settled(-3, 3)]);
    expect(w?.meanCost).toBe(-4);
    expect(w?.message).toContain('has not cost you');
  });

  it('only counts past overrides at least as large as the one proposed', () => {
    // Proposing 'max' on a rest day is magnitude 4; magnitude-1 history is not
    // comparable and must not be used to justify a warning.
    const w = warnFromHistory('max', lowDay, [settled(10, 1), settled(10, 1)]);
    expect(w).toBeUndefined();
  });
});

describe('warnFromHistory copy', () => {
  function settled(cost: number): OverrideOutcome {
    return {
      override: {
        date: '2026-08-01',
        recommended: 'easy',
        actual: 'hard',
        magnitude: 2,
        scoreAtOverride: 45,
      },
      status: 'settled',
      baselineScore: 80,
      postScore: 80 - cost,
      cost,
    };
  }

  it('uses "an" before a vowel-initial band and "a" otherwise', () => {
    const easyDay = readiness('2026-08-29', 45); // ceiling: easy
    const easyMsg = warnFromHistory('hard', easyDay, [settled(10), settled(12)])?.message;
    expect(easyMsg).toContain('an easy day');
    expect(easyMsg).not.toContain('a easy day');

    const restDay = readiness('2026-08-29', 20); // ceiling: rest
    const restMsg = warnFromHistory('hard', restDay, [
      { ...settled(10), override: { ...settled(10).override, magnitude: 3 } },
      { ...settled(12), override: { ...settled(12).override, magnitude: 3 } },
    ])?.message;
    expect(restMsg).toContain('a rest day');
  });
});
