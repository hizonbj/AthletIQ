import { describe, expect, it } from 'vitest';
import { replay } from '@/domain/replay';
import { computeReadiness } from '@/domain/readiness';
import { addDays } from '@/domain/dates';
import type { CheckIn, DayISO, Intensity, Session } from '@/domain/types';

/**
 * The reference implementation: the naive filter-per-day version the fast
 * replay replaced. Kept here so any divergence fails a test rather than
 * silently changing everyone's history.
 */
function referenceReplay(checkIns: CheckIn[], sessions: Session[]) {
  const days = new Set<DayISO>([
    ...checkIns.map((c) => c.date),
    ...sessions.map((s) => s.date),
  ]);
  const byDate = new Map(checkIns.map((c) => [c.date, c]));
  const out = new Map<DayISO, ReturnType<typeof computeReadiness>>();
  for (const date of [...days].sort()) {
    out.set(
      date,
      computeReadiness({
        date,
        checkIn: byDate.get(date),
        history: checkIns.filter((c) => c.date < date),
        sessions: sessions.filter((s) => s.date <= date),
      }),
    );
  }
  return out;
}

function expectMatchesReference(checkIns: CheckIn[], sessions: Session[]) {
  const fast = replay(checkIns, sessions);
  const reference = referenceReplay(checkIns, sessions);

  expect([...fast.keys()].sort()).toEqual([...reference.keys()].sort());
  for (const [date, expected] of reference) {
    const actual = fast.get(date);
    expect(actual, `day ${date}`).toBeDefined();
    expect(actual!.score, `score on ${date}`).toBe(expected.score);
    expect(actual!.band, `band on ${date}`).toBe(expected.band);
    expect(actual!.confidence, `confidence on ${date}`).toBeCloseTo(expected.confidence, 10);
    expect(
      actual!.contributions.map((c) => [c.key, c.normalized, c.display]),
      `contributions on ${date}`,
    ).toEqual(expected.contributions.map((c) => [c.key, c.normalized, c.display]));
  }
}

const TODAY = '2026-08-29';

describe('replay matches the reference implementation', () => {
  it('on an empty history', () => {
    expect(replay([], []).size).toBe(0);
  });

  it('on a single check-in', () => {
    expectMatchesReference([{ date: TODAY, sleepHours: 7, soreness: 2 }], []);
  });

  it('on sessions with no check-ins at all', () => {
    const sessions: Session[] = Array.from({ length: 30 }, (_, i) => ({
      date: addDays(TODAY, -i),
      intensity: 'moderate' as Intensity,
      durationMin: 60,
    }));
    expectMatchesReference([], sessions);
  });

  it('across a long dense history, where load and HR baselines are live', () => {
    const checkIns: CheckIn[] = [];
    const sessions: Session[] = [];
    for (let i = 120; i >= 0; i--) {
      const d = addDays(TODAY, -i);
      checkIns.push({
        date: d,
        sleepHours: 6 + (i % 9) * 0.25,
        sleepQuality: (i % 5) + 1,
        soreness: (i % 5) + 1,
        energy: ((i + 2) % 5) + 1,
        restingHr: 48 + (i % 11),
      });
      if (i % 2 === 0) {
        sessions.push({
          date: d,
          intensity: (i % 9 === 0 ? 'max' : i % 3 === 0 ? 'hard' : 'easy') as Intensity,
          durationMin: 45 + (i % 4) * 20,
        });
      }
    }
    expectMatchesReference(checkIns, sessions);
  });

  it('with gaps, so windows straddle days that have no data', () => {
    const checkIns: CheckIn[] = [];
    const sessions: Session[] = [];
    for (let i = 90; i >= 0; i -= 3) {
      const d = addDays(TODAY, -i);
      checkIns.push({ date: d, sleepHours: 7.5, soreness: 2, restingHr: 50 + (i % 5) });
      sessions.push({ date: d, intensity: 'moderate', durationMin: 60 });
    }
    expectMatchesReference(checkIns, sessions);
  });

  it('with several sessions on the same day', () => {
    const checkIns: CheckIn[] = [];
    const sessions: Session[] = [];
    for (let i = 40; i >= 0; i--) {
      const d = addDays(TODAY, -i);
      checkIns.push({ date: d, sleepHours: 8, soreness: 1 });
      sessions.push({ date: d, intensity: 'easy', durationMin: 30 });
      if (i % 5 === 0) sessions.push({ date: d, intensity: 'hard', durationMin: 60 });
    }
    expectMatchesReference(checkIns, sessions);
  });

  it('when check-ins and sessions fall on entirely different days', () => {
    const checkIns: CheckIn[] = [];
    const sessions: Session[] = [];
    for (let i = 60; i >= 0; i--) {
      const d = addDays(TODAY, -i);
      if (i % 2 === 0) checkIns.push({ date: d, sleepHours: 7, soreness: 3, restingHr: 52 });
      else sessions.push({ date: d, intensity: 'hard', durationMin: 75 });
    }
    expectMatchesReference(checkIns, sessions);
  });

  it('with unsorted input, which storage does not guarantee', () => {
    const checkIns: CheckIn[] = [
      { date: addDays(TODAY, -1), sleepHours: 6, restingHr: 55 },
      { date: addDays(TODAY, -30), sleepHours: 8, restingHr: 50 },
      { date: TODAY, sleepHours: 7, restingHr: 51 },
      { date: addDays(TODAY, -15), sleepHours: 5, restingHr: 60 },
    ];
    const sessions: Session[] = [
      { date: TODAY, intensity: 'hard', durationMin: 60 },
      { date: addDays(TODAY, -20), intensity: 'easy', durationMin: 30 },
    ];
    expectMatchesReference(checkIns, sessions);
  });

  it('across a year boundary', () => {
    const checkIns: CheckIn[] = [];
    for (let i = 40; i >= 0; i--) {
      checkIns.push({ date: addDays('2027-01-15', -i), sleepHours: 7, soreness: 2, restingHr: 50 });
    }
    expectMatchesReference(checkIns, []);
  });
});
