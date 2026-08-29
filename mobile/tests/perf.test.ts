import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '@/data/repository';
import { buildInsights, isLocked } from '@/domain/insights';
import { addDays } from '@/domain/dates';
import type { CheckIn, Session } from '@/domain/types';

/**
 * Two years of daily use — the point at which the record is most valuable and
 * the user has been paying longest.
 *
 * This guards against a return to the filter-per-day replay, which was
 * quadratic and took ~940ms here (several seconds on a phone) on every screen
 * focus. The threshold is loose enough for CI variance and tight enough that
 * quadratic behaviour cannot slip back in unnoticed.
 */
const BUDGET_MS = 300;

function twoYearsOfData() {
  const today = '2026-08-29';
  const checkIns: CheckIn[] = [];
  const sessions: Session[] = [];
  for (let i = 730; i >= 0; i--) {
    const d = addDays(today, -i);
    checkIns.push({
      date: d,
      sleepHours: 7 + (i % 5) * 0.25,
      sleepQuality: (i % 5) + 1,
      soreness: (i % 5) + 1,
      energy: (i % 5) + 1,
      restingHr: 48 + (i % 8),
    });
    if (i % 2 === 0) {
      sessions.push({
        date: d,
        intensity: i % 7 === 0 ? 'hard' : 'moderate',
        durationMin: 60,
      });
    }
  }
  return { today, checkIns, sessions };
}

describe('insights performance', () => {
  it(`builds two years of history within ${BUDGET_MS}ms`, async () => {
    const { today, checkIns, sessions } = twoYearsOfData();
    const repo = new InMemoryRepository({ checkIns, sessions });

    const start = performance.now();
    const insights = await buildInsights(repo, 'pro', today);
    const elapsed = performance.now() - start;

    // Guard the work actually happened, so a future short-circuit cannot make
    // this pass by doing nothing.
    expect(insights.history.length).toBeGreaterThan(700);
    if (isLocked(insights.overrides)) throw new Error('expected unlocked');
    expect(insights.overrides.length).toBeGreaterThan(0);

    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});
