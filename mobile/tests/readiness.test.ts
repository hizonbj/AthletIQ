import { describe, expect, it } from 'vitest';
import {
  bandForScore,
  ceilingForBand,
  computeReadiness,
  restingHrBaseline,
  scoreAcwr,
  scoreRestingHr,
  scoreSleepHours,
} from '@/domain/readiness';
import type { CheckIn, Session } from '@/domain/types';

describe('scoreSleepHours', () => {
  it('treats 7.5-9.5h as ideal', () => {
    expect(scoreSleepHours(7.5)).toBe(1);
    expect(scoreSleepHours(8.5)).toBe(1);
    expect(scoreSleepHours(9.5)).toBe(1);
  });

  it('ramps from 4h and floors below it', () => {
    expect(scoreSleepHours(4)).toBe(0);
    expect(scoreSleepHours(2)).toBe(0);
    expect(scoreSleepHours(5.75)).toBeCloseTo(0.5, 5);
  });

  it('declines gently past 9.5h rather than punishing it', () => {
    expect(scoreSleepHours(11.5)).toBeCloseTo(0.5, 5);
    expect(scoreSleepHours(10)).toBeGreaterThan(0.8);
  });
});

describe('scoreRestingHr', () => {
  it('is ideal at or below baseline', () => {
    expect(scoreRestingHr(50, 50)).toBe(1);
    expect(scoreRestingHr(45, 50)).toBe(1);
  });

  it('falls to zero at +10bpm', () => {
    expect(scoreRestingHr(60, 50)).toBe(0);
    expect(scoreRestingHr(55, 50)).toBeCloseTo(0.5, 5);
  });
});

describe('scoreAcwr', () => {
  it('does not penalize being fresh', () => {
    expect(scoreAcwr(0.5)).toBe(1);
    expect(scoreAcwr(1.0)).toBe(1);
    expect(scoreAcwr(1.3)).toBe(1);
  });

  it('penalizes ramping faster than conditioning', () => {
    expect(scoreAcwr(1.65)).toBeCloseTo(0.5, 5);
    expect(scoreAcwr(2.0)).toBe(0);
    expect(scoreAcwr(3.0)).toBe(0);
  });
});

describe('bandForScore', () => {
  it('maps scores to bands at the documented boundaries', () => {
    expect(bandForScore(0)).toBe('rest');
    expect(bandForScore(39)).toBe('rest');
    expect(bandForScore(40)).toBe('easy');
    expect(bandForScore(59)).toBe('easy');
    expect(bandForScore(60)).toBe('moderate');
    expect(bandForScore(79)).toBe('moderate');
    expect(bandForScore(80)).toBe('go');
    expect(bandForScore(100)).toBe('go');
  });

  it('maps bands to an intensity ceiling', () => {
    expect(ceilingForBand('rest')).toBe('rest');
    expect(ceilingForBand('easy')).toBe('easy');
    expect(ceilingForBand('moderate')).toBe('moderate');
    expect(ceilingForBand('go')).toBe('max');
  });
});

describe('restingHrBaseline', () => {
  const mk = (date: string, restingHr: number): CheckIn => ({ date, restingHr });

  it('is undefined below the minimum sample count', () => {
    const history = [mk('2026-08-01', 50), mk('2026-08-02', 51)];
    expect(restingHrBaseline(history, '2026-08-10')).toBeUndefined();
  });

  it('takes the median of the trailing window', () => {
    const history = [
      mk('2026-08-01', 50),
      mk('2026-08-02', 52),
      mk('2026-08-03', 54),
      mk('2026-08-04', 56),
      mk('2026-08-05', 58),
    ];
    expect(restingHrBaseline(history, '2026-08-10')).toBe(54);
  });

  it('excludes the current day so today does not define its own baseline', () => {
    const history = [
      mk('2026-08-01', 50),
      mk('2026-08-02', 50),
      mk('2026-08-03', 50),
      mk('2026-08-04', 50),
      mk('2026-08-05', 50),
      mk('2026-08-10', 90),
    ];
    expect(restingHrBaseline(history, '2026-08-10')).toBe(50);
  });

  it('ignores days older than the window', () => {
    const history = [
      mk('2026-01-01', 90),
      mk('2026-08-01', 50),
      mk('2026-08-02', 50),
      mk('2026-08-03', 50),
      mk('2026-08-04', 50),
      mk('2026-08-05', 50),
    ];
    expect(restingHrBaseline(history, '2026-08-10')).toBe(50);
  });
});

describe('computeReadiness', () => {
  it('returns a neutral score with zero confidence when there is no data', () => {
    const r = computeReadiness({
      date: '2026-08-29',
      checkIn: undefined,
      history: [],
      sessions: [],
    });
    expect(r.score).toBe(50);
    expect(r.confidence).toBe(0);
    expect(r.contributions).toHaveLength(0);
  });

  it('scores a fully rested athlete high', () => {
    const r = computeReadiness({
      date: '2026-08-29',
      checkIn: { date: '2026-08-29', sleepHours: 8, sleepQuality: 5, soreness: 1, energy: 5 },
      history: [],
      sessions: [],
    });
    expect(r.score).toBe(100);
    expect(r.band).toBe('go');
    expect(r.limiters).toHaveLength(0);
  });

  it('scores a wrecked athlete low and names the limiters', () => {
    const r = computeReadiness({
      date: '2026-08-29',
      checkIn: { date: '2026-08-29', sleepHours: 4, sleepQuality: 1, soreness: 5, energy: 1 },
      history: [],
      sessions: [],
    });
    expect(r.score).toBe(0);
    expect(r.band).toBe('rest');
    expect(r.recommendedCeiling).toBe('rest');
    expect(r.limiters.map((l) => l.key).sort()).toEqual([
      'energy',
      'sleepHours',
      'sleepQuality',
      'soreness',
    ]);
  });

  it('renormalizes over available signals when data is partial', () => {
    // Only soreness present, and it is perfect: score should be 100, not
    // diluted toward zero by the signals we do not have.
    const r = computeReadiness({
      date: '2026-08-29',
      checkIn: { date: '2026-08-29', soreness: 1 },
      history: [],
      sessions: [],
    });
    expect(r.score).toBe(100);
    expect(r.confidence).toBeLessThan(0.3);
  });

  it('reports confidence as the share of model weight with data behind it', () => {
    const r = computeReadiness({
      date: '2026-08-29',
      checkIn: { date: '2026-08-29', sleepHours: 8, soreness: 2 },
      history: [],
      sessions: [],
    });
    // sleepHours(3) + soreness(3) out of a total of 15.
    expect(r.confidence).toBeCloseTo(6 / 15, 5);
  });

  it('drops resting HR when there is no personal baseline yet', () => {
    const r = computeReadiness({
      date: '2026-08-29',
      checkIn: { date: '2026-08-29', restingHr: 70, soreness: 1 },
      history: [],
      sessions: [],
    });
    expect(r.contributions.map((c) => c.key)).not.toContain('restingHr');
  });

  it('includes resting HR once a baseline exists', () => {
    const history: CheckIn[] = ['08-01', '08-02', '08-03', '08-04', '08-05'].map((d) => ({
      date: `2026-${d}`,
      restingHr: 50,
    }));
    const r = computeReadiness({
      date: '2026-08-10',
      checkIn: { date: '2026-08-10', restingHr: 60, soreness: 1 },
      history,
      sessions: [],
    });
    const hr = r.contributions.find((c) => c.key === 'restingHr');
    expect(hr).toBeDefined();
    expect(hr?.normalized).toBe(0);
    expect(hr?.display).toContain('+10');
  });

  it('drags the score down when training load has spiked', () => {
    // 28 days of steady easy work, then a very heavy final week.
    const sessions: Session[] = [];
    for (let i = 27; i >= 7; i--) {
      sessions.push({ date: dayBefore('2026-08-29', i), intensity: 'easy', durationMin: 60 });
    }
    for (let i = 6; i >= 0; i--) {
      sessions.push({ date: dayBefore('2026-08-29', i), intensity: 'max', durationMin: 120 });
    }
    const r = computeReadiness({
      date: '2026-08-29',
      checkIn: { date: '2026-08-29', soreness: 1 },
      history: [],
      sessions,
    });
    const load = r.contributions.find((c) => c.key === 'load');
    expect(load).toBeDefined();
    expect(load?.normalized).toBe(0);
    expect(r.score).toBeLessThan(100);
  });
});

function dayBefore(date: string, n: number): string {
  const d = new Date(Date.parse(`${date}T00:00:00.000Z`) - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe('signal display strings', () => {
  function contributionsFor(checkIn: CheckIn) {
    const r = computeReadiness({ date: '2026-08-29', checkIn, history: [], sessions: [] });
    return new Map(r.contributions.map((c) => [c.key, c.display]));
  }

  it('names subjective scales instead of printing a bare number', () => {
    // "3/5" forces the reader to reconstruct a private rubric; the word does not.
    const display = contributionsFor({
      date: '2026-08-29',
      sleepQuality: 3,
      soreness: 4,
      energy: 1,
    });
    expect(display.get('sleepQuality')).toBe('OK');
    expect(display.get('soreness')).toBe('Sore');
    expect(display.get('energy')).toBe('Drained');
  });

  it('uses each scale\'s own vocabulary at the extremes', () => {
    const low = contributionsFor({ date: '2026-08-29', sleepQuality: 1, soreness: 1, energy: 5 });
    expect(low.get('sleepQuality')).toBe('Terrible');
    expect(low.get('soreness')).toBe('None');
    expect(low.get('energy')).toBe('Flying');
  });

  it('formats sleep the way the check-in ruler does', () => {
    expect(contributionsFor({ date: '2026-08-29', sleepHours: 8 }).get('sleepHours')).toBe('8h');
    expect(contributionsFor({ date: '2026-08-29', sleepHours: 7.5 }).get('sleepHours')).toBe(
      '7h 30m',
    );
    expect(contributionsFor({ date: '2026-08-29', sleepHours: 6.25 }).get('sleepHours')).toBe(
      '6h 15m',
    );
  });
});
