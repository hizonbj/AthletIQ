import { describe, expect, it } from 'vitest';
import {
  FEATURES,
  FREE_HISTORY_DAYS,
  hasFeature,
  historyLimitDays,
  UPSELL_COPY,
} from '@/subscription/entitlements';
import { COACH_PLANS, DEFAULT_PLANS, MockPurchaseStore } from '@/subscription/store';

describe('entitlements', () => {
  it('gives the free tier today\'s score and logging, forever', () => {
    expect(hasFeature('free', 'todayScore')).toBe(true);
    expect(hasFeature('free', 'todayLimiters')).toBe(true);
    expect(hasFeature('free', 'logSession')).toBe(true);
  });

  it('withholds the record — the paid thesis — from free', () => {
    expect(hasFeature('free', 'overrideLog')).toBe(false);
    expect(hasFeature('free', 'outcomePatterns')).toBe(false);
    expect(hasFeature('free', 'priorWarning')).toBe(false);
    expect(hasFeature('free', 'historyFull')).toBe(false);
  });

  it('gives pro every personal feature but not the roster', () => {
    for (const f of FEATURES) {
      expect(hasFeature('pro', f)).toBe(f !== 'roster');
    }
  });

  it('gives coach everything, as a superset of pro', () => {
    for (const f of FEATURES) expect(hasFeature('coach', f)).toBe(true);
  });

  it('keeps the roster out of the free and pro tiers', () => {
    expect(hasFeature('free', 'roster')).toBe(false);
    expect(hasFeature('pro', 'roster')).toBe(false);
    expect(hasFeature('coach', 'roster')).toBe(true);
  });

  it('caps free history and leaves both paid tiers unlimited', () => {
    expect(historyLimitDays('free')).toBe(FREE_HISTORY_DAYS);
    expect(historyLimitDays('pro')).toBe(Number.POSITIVE_INFINITY);
    expect(historyLimitDays('coach')).toBe(Number.POSITIVE_INFINITY);
  });

  it('has upsell copy for every paid feature', () => {
    for (const f of FEATURES) {
      if (!hasFeature('free', f)) expect(UPSELL_COPY[f].length).toBeGreaterThan(0);
    }
  });
});

describe('MockPurchaseStore', () => {
  it('starts free and upgrades on purchase', async () => {
    const store = new MockPurchaseStore();
    expect(await store.getTier()).toBe('free');
    const result = await store.purchase('athletiq.pro.annual');
    expect(result.tier).toBe('pro');
    expect(await store.getTier()).toBe('pro');
  });

  it('rejects an unknown plan rather than silently upgrading', async () => {
    const store = new MockPurchaseStore();
    await expect(store.purchase('not.a.plan')).rejects.toThrow(/Unknown plan/);
    expect(await store.getTier()).toBe('free');
  });

  it('restores the tier it already holds', async () => {
    const store = new MockPurchaseStore('pro');
    expect((await store.restore()).tier).toBe('pro');
  });

  it('offers monthly and annual consumer plans plus a per-athlete coach plan', async () => {
    const plans = await new MockPurchaseStore().getPlans();
    expect(plans.map((p) => p.id)).toEqual([
      'athletiq.pro.monthly',
      'athletiq.pro.annual',
      'athletiq.coach.monthly',
    ]);
    expect(DEFAULT_PLANS.every((p) => p.id.startsWith('athletiq.pro.'))).toBe(true);
    expect(COACH_PLANS.every((p) => p.id.startsWith('athletiq.coach.'))).toBe(true);
  });

  it('grants the coach tier for a coach plan, not merely pro', async () => {
    const store = new MockPurchaseStore();
    const result = await store.purchase('athletiq.coach.monthly');
    expect(result.tier).toBe('coach');
    expect(await store.getTier()).toBe('coach');
  });
});
