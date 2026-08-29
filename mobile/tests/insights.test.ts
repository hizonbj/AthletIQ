import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '@/data/repository';
import { buildInsights, checkBeforeSession, isLocked, replayReadiness } from '@/domain/insights';
import { addDays } from '@/domain/dates';
import type { CheckIn, Session } from '@/domain/types';

const TODAY = '2026-08-29';

/** A wrecked athlete: low sleep, high soreness, flat energy. Readiness ~0. */
function badDay(date: string): CheckIn {
  return { date, sleepHours: 4, sleepQuality: 1, soreness: 5, energy: 1 };
}

/** A fresh athlete. Readiness 100. */
function goodDay(date: string): CheckIn {
  return { date, sleepHours: 8, sleepQuality: 5, soreness: 1, energy: 5 };
}

describe('replayReadiness', () => {
  it('scores every day that has any data', () => {
    const map = replayReadiness(
      [goodDay('2026-08-27'), badDay('2026-08-28')],
      [{ date: '2026-08-29', intensity: 'easy', durationMin: 30 }],
    );
    expect([...map.keys()].sort()).toEqual(['2026-08-27', '2026-08-28', '2026-08-29']);
    expect(map.get('2026-08-27')?.score).toBe(100);
    expect(map.get('2026-08-28')?.score).toBe(0);
  });

  it('does not let later data change an earlier day\'s score', () => {
    const early = replayReadiness([goodDay('2026-08-01')], []);
    const later = replayReadiness([goodDay('2026-08-01'), badDay('2026-08-20')], []);
    expect(later.get('2026-08-01')?.score).toBe(early.get('2026-08-01')?.score);
  });
});

describe('buildInsights gating', () => {
  async function repoWithOverrides() {
    const repo = new InMemoryRepository();
    // 20 days of solid readiness, then a bad day the athlete trains hard on.
    for (let i = 25; i >= 6; i--) await repo.putCheckIn(goodDay(addDays(TODAY, -i)));
    await repo.putCheckIn(badDay(addDays(TODAY, -5)));
    await repo.addSession({ date: addDays(TODAY, -5), intensity: 'hard', durationMin: 90 });
    for (let i = 4; i >= 0; i--) await repo.putCheckIn(badDay(addDays(TODAY, -i)));
    return repo;
  }

  it('locks the override log and pattern on the free tier', async () => {
    const insights = await buildInsights(await repoWithOverrides(), 'free', TODAY);
    expect(isLocked(insights.overrides)).toBe(true);
    expect(isLocked(insights.pattern)).toBe(true);
  });

  it('unlocks them on pro', async () => {
    const insights = await buildInsights(await repoWithOverrides(), 'pro', TODAY);
    expect(isLocked(insights.overrides)).toBe(false);
    expect(isLocked(insights.pattern)).toBe(false);
    if (isLocked(insights.overrides)) throw new Error('expected unlocked');
    expect(insights.overrides).toHaveLength(1);
    expect(insights.overrides[0].override.actual).toBe('hard');
  });

  it('settles the override outcome with a real cost', async () => {
    const insights = await buildInsights(await repoWithOverrides(), 'pro', TODAY);
    if (isLocked(insights.pattern)) throw new Error('expected unlocked');
    expect(insights.pattern.settledCount).toBe(1);
    // Baseline was 100 (good days), the days after were 0 (bad days).
    expect(insights.pattern.meanCost).toBe(100);
    expect(insights.pattern.costlyCount).toBe(1);
  });

  it('caps free history at 7 days and flags the truncation', async () => {
    const insights = await buildInsights(await repoWithOverrides(), 'free', TODAY);
    expect(insights.history.length).toBeLessThanOrEqual(7);
    expect(insights.historyTruncated).toBe(true);
  });

  it('gives pro the full history untruncated', async () => {
    const insights = await buildInsights(await repoWithOverrides(), 'pro', TODAY);
    expect(insights.history.length).toBeGreaterThan(7);
    expect(insights.historyTruncated).toBe(false);
  });

  it('always gives the free tier today\'s score', async () => {
    const insights = await buildInsights(await repoWithOverrides(), 'free', TODAY);
    expect(insights.today.readiness.score).toBe(0);
    expect(insights.today.readiness.band).toBe('rest');
    expect(insights.today.needsCheckIn).toBe(false);
  });

  it('flags a missing check-in for today', async () => {
    const repo = new InMemoryRepository({ checkIns: [goodDay(addDays(TODAY, -1))] });
    const insights = await buildInsights(repo, 'free', TODAY);
    expect(insights.today.needsCheckIn).toBe(true);
  });

  it('handles an empty repository without throwing', async () => {
    const insights = await buildInsights(new InMemoryRepository(), 'free', TODAY);
    expect(insights.today.readiness.score).toBe(50);
    expect(insights.today.readiness.confidence).toBe(0);
    expect(insights.history).toEqual([]);
  });
});

describe('checkBeforeSession', () => {
  /** Three settled overrides so the warning has comparable history. */
  async function repoWithPriorOverrides() {
    const repo = new InMemoryRepository();
    for (let i = 60; i >= 0; i--) {
      const d = addDays(TODAY, -i);
      // Bad on the override days and the three days after; good otherwise.
      const overrideDays = [50, 35, 20];
      // Today is also a bad day, so proposing a hard session is an override now.
      const isBad = i === 0 || overrideDays.some((o) => i <= o && i >= o - 3);
      await repo.putCheckIn(isBad ? badDay(d) : goodDay(d));
      if (overrideDays.includes(i)) {
        await repo.addSession({ date: d, intensity: 'hard', durationMin: 90 });
      }
    }
    return repo;
  }

  it('detects that a hard session exceeds a rest-day recommendation', async () => {
    const repo = new InMemoryRepository({ checkIns: [badDay(TODAY)] });
    const out = await checkBeforeSession(repo, 'pro', TODAY, 'hard');
    expect(out.isOverride).toBe(true);
  });

  it('does not flag a session within the recommendation', async () => {
    const repo = new InMemoryRepository({ checkIns: [goodDay(TODAY)] });
    const out = await checkBeforeSession(repo, 'pro', TODAY, 'hard');
    expect(out.isOverride).toBe(false);
    expect(out.warning).toBeUndefined();
  });

  it('locks the cost of the warning for free users but still admits the override', async () => {
    const repo = await repoWithPriorOverrides();
    const out = await checkBeforeSession(repo, 'free', TODAY, 'hard');
    expect(out.isOverride).toBe(true);
    expect(isLocked(out.warning)).toBe(true);
  });

  it('gives pro the warning built from their own history', async () => {
    const repo = await repoWithPriorOverrides();
    const out = await checkBeforeSession(repo, 'pro', TODAY, 'hard');
    expect(out.isOverride).toBe(true);
    if (isLocked(out.warning)) throw new Error('expected unlocked');
    expect(out.warning).toBeDefined();
    expect(out.warning?.comparableCount).toBeGreaterThanOrEqual(2);
    expect(out.warning?.message).toMatch(/pushed past/);
  });

  it('returns no warning for free users when there is no override at all', async () => {
    const repo = new InMemoryRepository({ checkIns: [goodDay(TODAY)] });
    const out = await checkBeforeSession(repo, 'free', TODAY, 'easy');
    expect(out.isOverride).toBe(false);
    expect(out.warning).toBeUndefined();
  });
});
