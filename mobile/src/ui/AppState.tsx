/**
 * App-wide state: the repository, the entitlement tier, and the derived
 * insights. One provider so screens stay presentational and every screen sees
 * the same gating decision.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { buildInsights, type Insights } from '@/domain/insights';
import { toDayISO } from '@/domain/dates';
import type { CheckIn, DayISO, Session } from '@/domain/types';
import { createRepository } from '@/data/factory';
import type { Repository } from '@/data/repository';
import { MockPurchaseStore, type PurchaseStore } from '@/subscription/store';
import type { Tier } from '@/subscription/entitlements';

interface AppStateValue {
  ready: boolean;
  today: DayISO;
  tier: Tier;
  insights?: Insights;
  repo: Repository;
  purchases: PurchaseStore;
  saveCheckIn(c: CheckIn): Promise<void>;
  addSession(s: Session): Promise<void>;
  refresh(): Promise<void>;
  setTier(t: Tier): void;
}

const Ctx = createContext<AppStateValue | null>(null);

export function useApp(): AppStateValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useApp must be used inside <AppStateProvider>');
  return value;
}

export function AppStateProvider({
  children,
  repository,
  purchaseStore,
}: {
  children: React.ReactNode;
  /** Injectable so previews and tests can swap in an in-memory repository. */
  repository?: Repository;
  purchaseStore?: PurchaseStore;
}) {
  const repo = useMemo(() => repository ?? createRepository(), [repository]);
  const purchases = useMemo(() => purchaseStore ?? new MockPurchaseStore(), [purchaseStore]);

  const [tier, setTier] = useState<Tier>('free');
  const [insights, setInsights] = useState<Insights>();
  const [ready, setReady] = useState(false);
  const today = useMemo(() => toDayISO(new Date()), []);

  const refresh = useCallback(async () => {
    const next = await buildInsights(repo, tier, today);
    setInsights(next);
  }, [repo, tier, today]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await purchases.getTier();
      if (cancelled) return;
      setTier(restored);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [purchases]);

  // Re-derive whenever the tier changes: upgrading must unlock immediately.
  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  const saveCheckIn = useCallback(
    async (c: CheckIn) => {
      await repo.putCheckIn(c);
      await refresh();
    },
    [repo, refresh],
  );

  const addSession = useCallback(
    async (s: Session) => {
      await repo.addSession(s);
      await refresh();
    },
    [repo, refresh],
  );

  const value: AppStateValue = {
    ready,
    today,
    tier,
    insights,
    repo,
    purchases,
    saveCheckIn,
    addSession,
    refresh,
    setTier,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
