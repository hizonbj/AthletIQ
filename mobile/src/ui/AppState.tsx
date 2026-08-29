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
import { createRepository, createRosterRepository } from '@/data/factory';
import type { Repository } from '@/data/repository';
import type { RosterRepository } from '@/data/rosterRepository';
import { MockPurchaseStore, type PurchaseStore } from '@/subscription/store';
import type { Tier } from '@/subscription/entitlements';
import { createHealthProvider } from '@/health/factory';
import { importHealthData, type ImportResult } from '@/health/import';
import type { HealthProvider } from '@/health/types';

interface AppStateValue {
  ready: boolean;
  today: DayISO;
  tier: Tier;
  insights?: Insights;
  repo: Repository;
  rosterRepo: RosterRepository;
  purchases: PurchaseStore;
  saveCheckIn(c: CheckIn): Promise<void>;
  addSession(s: Session): Promise<void>;
  refresh(): Promise<void>;
  setTier(t: Tier): void;
  importHealth(): Promise<ImportResult>;
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
  rosterRepository,
  purchaseStore,
  healthProvider,
}: {
  children: React.ReactNode;
  /** Injectable so previews and tests can swap in an in-memory repository. */
  repository?: Repository;
  rosterRepository?: RosterRepository;
  purchaseStore?: PurchaseStore;
  healthProvider?: HealthProvider;
}) {
  const repo = useMemo(() => repository ?? createRepository(), [repository]);
  const purchases = useMemo(() => purchaseStore ?? new MockPurchaseStore(), [purchaseStore]);
  const rosterRepo = useMemo(
    () => rosterRepository ?? createRosterRepository(),
    [rosterRepository],
  );
  const health = useMemo(() => healthProvider ?? createHealthProvider(), [healthProvider]);

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

  const importHealth = useCallback(async () => {
    const result = await importHealthData(health, repo, today);
    if (result.filledCount > 0) await refresh();
    return result;
  }, [health, repo, today, refresh]);

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
    rosterRepo,
    purchases,
    saveCheckIn,
    addSession,
    refresh,
    setTier,
    importHealth,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
