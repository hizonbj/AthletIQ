/**
 * Pure mapping between RevenueCat's payloads and this app's types.
 *
 * Deliberately free of `react-native-purchases` and `react-native` imports so
 * it can be unit tested in Node — this is where the logic that can actually be
 * wrong lives (which entitlement wins, what counts as a cancellation), while
 * the adapter class around it is thin SDK plumbing.
 *
 * The types below are structural subsets of the SDK's, so real SDK objects
 * satisfy them without a cast at the call site.
 */
import type { Tier } from './entitlements';
import type { SubscriptionPlan } from './store';

/** Entitlement ids as configured in the RevenueCat dashboard. */
export const ENTITLEMENT_PRO = 'pro';
export const ENTITLEMENT_COACH = 'coach';

export interface EntitlementLike {
  expirationDate?: string | null;
}

export interface CustomerInfoLike {
  entitlements: { active: Record<string, EntitlementLike | undefined> };
}

export interface PackageLike {
  identifier: string;
  packageType: string;
  product: { title: string; priceString: string };
}

/** Coach outranks pro: a coach subscription includes everything pro has. */
export function tierFromCustomerInfo(info: CustomerInfoLike): Tier {
  const active = info.entitlements.active;
  if (active[ENTITLEMENT_COACH]) return 'coach';
  if (active[ENTITLEMENT_PRO]) return 'pro';
  return 'free';
}

/** The expiry of whichever entitlement granted the tier, when it has one. */
export function expiryFromCustomerInfo(info: CustomerInfoLike): string | undefined {
  const active = info.entitlements.active;
  const granting = active[ENTITLEMENT_COACH] ?? active[ENTITLEMENT_PRO];
  return granting?.expirationDate ?? undefined;
}

/** Map a RevenueCat package onto the app's plan shape. */
export function planFromPackage(pkg: PackageLike): SubscriptionPlan {
  return {
    id: pkg.identifier,
    title: pkg.product.title,
    // Always the store-localized string: never format currency ourselves.
    price: pkg.product.priceString,
    period: pkg.packageType === 'ANNUAL' ? 'annual' : 'monthly',
  };
}

/** RevenueCat reports a dismissed store sheet as an error with this flag set. */
export function isUserCancelled(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { userCancelled?: boolean }).userCancelled === true
  );
}
