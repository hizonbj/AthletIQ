/**
 * RevenueCat-backed PurchaseStore.
 *
 * Thin plumbing over the SDK; the decisions live in `revenueCatMapping.ts`,
 * which is unit tested. Implements the same interface as MockPurchaseStore, so
 * nothing above it changes.
 *
 * NOTE: this path requires native modules and cannot run in Expo Go or on web.
 * It needs a development build (`npx expo prebuild` plus a device or simulator)
 * and real API keys. See the README for setup.
 */
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type PurchasesPackage } from 'react-native-purchases';
import {
  expiryFromCustomerInfo,
  isUserCancelled,
  planFromPackage,
  tierFromCustomerInfo,
} from './revenueCatMapping';
import type { Tier } from './entitlements';
import {
  PurchaseCancelledError,
  type PurchaseResult,
  type PurchaseStore,
  type SubscriptionPlan,
} from './store';

export { ENTITLEMENT_COACH, ENTITLEMENT_PRO } from './revenueCatMapping';

export interface RevenueCatConfig {
  iosApiKey: string;
  androidApiKey: string;
  /** Your own user id, when you have one. Omit for an anonymous RevenueCat id. */
  appUserId?: string;
  debug?: boolean;
}

export class RevenueCatPurchaseStore implements PurchaseStore {
  private configured = false;
  private packages: PurchasesPackage[] = [];

  constructor(private readonly config: RevenueCatConfig) {}

  private async ensureConfigured(): Promise<void> {
    if (this.configured) return;
    if (this.config.debug) await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    const apiKey = Platform.OS === 'ios' ? this.config.iosApiKey : this.config.androidApiKey;
    await Purchases.configure({ apiKey, appUserID: this.config.appUserId ?? null });
    this.configured = true;
  }

  async getTier(): Promise<Tier> {
    await this.ensureConfigured();
    return tierFromCustomerInfo(await Purchases.getCustomerInfo());
  }

  async getPlans(): Promise<SubscriptionPlan[]> {
    await this.ensureConfigured();
    const offerings = await Purchases.getOfferings();
    this.packages = offerings.current?.availablePackages ?? [];
    return this.packages.map(planFromPackage);
  }

  async purchase(planId: string): Promise<PurchaseResult> {
    await this.ensureConfigured();
    // getPlans may not have run yet (a deep link straight to the paywall).
    if (this.packages.length === 0) await this.getPlans();

    const pkg = this.packages.find((p) => p.identifier === planId);
    if (!pkg) throw new Error(`Unknown plan: ${planId}`);

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return {
        tier: tierFromCustomerInfo(customerInfo),
        expiresAt: expiryFromCustomerInfo(customerInfo),
      };
    } catch (e) {
      if (isUserCancelled(e)) throw new PurchaseCancelledError();
      throw e;
    }
  }

  async restore(): Promise<PurchaseResult> {
    await this.ensureConfigured();
    const customerInfo = await Purchases.restorePurchases();
    return {
      tier: tierFromCustomerInfo(customerInfo),
      expiresAt: expiryFromCustomerInfo(customerInfo),
    };
  }
}
