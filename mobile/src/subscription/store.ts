/**
 * Purchase layer.
 *
 * Kept behind an interface so the domain and UI never import a billing SDK
 * directly. `MockPurchaseStore` runs in development and in tests; the
 * RevenueCat-backed implementation drops in behind the same shape without any
 * caller changing.
 */
import type { Tier } from './entitlements';

export interface SubscriptionPlan {
  id: string;
  title: string;
  /** Display price, already localized by the store. */
  price: string;
  period: 'monthly' | 'annual';
  /** e.g. "Save 42%" — shown as a badge. */
  badge?: string;
}

export interface PurchaseResult {
  tier: Tier;
  /** Undefined for a lifetime or non-expiring entitlement. */
  expiresAt?: string;
}

export interface PurchaseStore {
  getTier(): Promise<Tier>;
  getPlans(): Promise<SubscriptionPlan[]>;
  purchase(planId: string): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
}

export const DEFAULT_PLANS: SubscriptionPlan[] = [
  { id: 'athletiq.pro.monthly', title: 'Monthly', price: '$9.99', period: 'monthly' },
  {
    id: 'athletiq.pro.annual',
    title: 'Annual',
    price: '$69.99',
    period: 'annual',
    badge: 'Save 42%',
  },
];

/** In-memory store for development and tests. */
export class MockPurchaseStore implements PurchaseStore {
  private tier: Tier;

  constructor(initial: Tier = 'free') {
    this.tier = initial;
  }

  async getTier(): Promise<Tier> {
    return this.tier;
  }

  async getPlans(): Promise<SubscriptionPlan[]> {
    return DEFAULT_PLANS;
  }

  async purchase(planId: string): Promise<PurchaseResult> {
    if (!DEFAULT_PLANS.some((p) => p.id === planId)) {
      throw new Error(`Unknown plan: ${planId}`);
    }
    this.tier = 'pro';
    return { tier: 'pro' };
  }

  async restore(): Promise<PurchaseResult> {
    return { tier: this.tier };
  }
}
