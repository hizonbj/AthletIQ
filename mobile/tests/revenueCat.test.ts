import { describe, expect, it } from 'vitest';
import {
  ENTITLEMENT_COACH,
  ENTITLEMENT_PRO,
  expiryFromCustomerInfo,
  isUserCancelled,
  planFromPackage,
  tierFromCustomerInfo,
} from '@/subscription/revenueCatMapping';
import type { CustomerInfoLike, PackageLike } from '@/subscription/revenueCatMapping';

/** Fixtures use the structural types the mapping module accepts. */
function customerInfo(
  active: Record<string, { expirationDate?: string | null }>,
): CustomerInfoLike {
  return { entitlements: { active } };
}

describe('tierFromCustomerInfo', () => {
  it('is free with no active entitlements', () => {
    expect(tierFromCustomerInfo(customerInfo({}))).toBe('free');
  });

  it('maps the pro entitlement to pro', () => {
    expect(tierFromCustomerInfo(customerInfo({ [ENTITLEMENT_PRO]: {} }))).toBe('pro');
  });

  it('maps the coach entitlement to coach', () => {
    expect(tierFromCustomerInfo(customerInfo({ [ENTITLEMENT_COACH]: {} }))).toBe('coach');
  });

  it('prefers coach when both are active, since coach is the superset', () => {
    const info = customerInfo({ [ENTITLEMENT_PRO]: {}, [ENTITLEMENT_COACH]: {} });
    expect(tierFromCustomerInfo(info)).toBe('coach');
  });

  it('ignores an unrelated entitlement', () => {
    expect(tierFromCustomerInfo(customerInfo({ somethingElse: {} }))).toBe('free');
  });
});

describe('expiryFromCustomerInfo', () => {
  it('returns the expiry of the granting entitlement', () => {
    const info = customerInfo({ [ENTITLEMENT_PRO]: { expirationDate: '2027-01-01T00:00:00Z' } });
    expect(expiryFromCustomerInfo(info)).toBe('2027-01-01T00:00:00Z');
  });

  it('prefers the coach expiry when coach is what granted the tier', () => {
    const info = customerInfo({
      [ENTITLEMENT_PRO]: { expirationDate: '2027-01-01T00:00:00Z' },
      [ENTITLEMENT_COACH]: { expirationDate: '2028-06-01T00:00:00Z' },
    });
    expect(expiryFromCustomerInfo(info)).toBe('2028-06-01T00:00:00Z');
  });

  it('is undefined for a non-expiring entitlement', () => {
    expect(expiryFromCustomerInfo(customerInfo({ [ENTITLEMENT_PRO]: { expirationDate: null } })))
      .toBeUndefined();
  });

  it('is undefined when nothing is active', () => {
    expect(expiryFromCustomerInfo(customerInfo({}))).toBeUndefined();
  });
});

describe('planFromPackage', () => {
  function pkg(packageType: string, priceString: string): PackageLike {
    return {
      identifier: `pkg.${packageType}`,
      packageType,
      product: { title: 'AthletIQ Pro', priceString },
    };
  }

  it('marks an annual package as annual', () => {
    expect(planFromPackage(pkg('ANNUAL', '$69.99')).period).toBe('annual');
  });

  it('treats every non-annual package as monthly', () => {
    expect(planFromPackage(pkg('MONTHLY', '$9.99')).period).toBe('monthly');
    expect(planFromPackage(pkg('CUSTOM', '$12.00')).period).toBe('monthly');
  });

  it('uses the store-localized price string rather than formatting our own', () => {
    // A euro price must survive untouched; formatting it ourselves would be wrong.
    expect(planFromPackage(pkg('MONTHLY', '9,99 €')).price).toBe('9,99 €');
  });

  it('carries the package identifier through as the plan id', () => {
    expect(planFromPackage(pkg('ANNUAL', '$69.99')).id).toBe('pkg.ANNUAL');
  });
});

describe('isUserCancelled', () => {
  it('recognizes a cancelled purchase', () => {
    expect(isUserCancelled({ userCancelled: true })).toBe(true);
  });

  it('does not treat a real failure as a cancellation', () => {
    expect(isUserCancelled({ userCancelled: false })).toBe(false);
    expect(isUserCancelled(new Error('network down'))).toBe(false);
    expect(isUserCancelled(null)).toBe(false);
    expect(isUserCancelled(undefined)).toBe(false);
  });
});
