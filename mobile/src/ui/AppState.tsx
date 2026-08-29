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
import { AsyncStoragePreferences } from '@/settings/preferences';
import {
  DEFAULT_PREFERENCES,
  type Preferences,
  type PreferencesStore,
  type ReminderSettings,
} from '@/settings/types';
import { createReminders } from '@/notifications/factory';
import type { Reminders } from '@/notifications/types';

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
  prefs: Preferences;
  /** Persists and reschedules the reminder. Returns false if permission was refused. */
  setReminder(settings: ReminderSettings): Promise<boolean>;
  completeOnboarding(): Promise<void>;
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
  preferencesStore,
  reminders,
}: {
  children: React.ReactNode;
  /** Injectable so previews and tests can swap in an in-memory repository. */
  repository?: Repository;
  rosterRepository?: RosterRepository;
  purchaseStore?: PurchaseStore;
  healthProvider?: HealthProvider;
  preferencesStore?: PreferencesStore;
  reminders?: Reminders;
}) {
  const repo = useMemo(() => repository ?? createRepository(), [repository]);
  const purchases = useMemo(() => purchaseStore ?? new MockPurchaseStore(), [purchaseStore]);
  const rosterRepo = useMemo(
    () => rosterRepository ?? createRosterRepository(),
    [rosterRepository],
  );
  const health = useMemo(() => healthProvider ?? createHealthProvider(), [healthProvider]);
  const prefsStore = useMemo(
    () => preferencesStore ?? new AsyncStoragePreferences(),
    [preferencesStore],
  );
  const reminderService = useMemo(() => reminders ?? createReminders(), [reminders]);

  const [tier, setTier] = useState<Tier>('free');
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
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
      const [restored, loadedPrefs] = await Promise.all([
        purchases.getTier(),
        prefsStore.load(),
      ]);
      if (cancelled) return;
      setTier(restored);
      setPrefs(loadedPrefs);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [purchases, prefsStore]);

  // Re-derive whenever the tier changes: upgrading must unlock immediately.
  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);

  const importHealth = useCallback(async () => {
    const result = await importHealthData(health, repo, today);
    if (result.filledCount > 0) await refresh();
    return result;
  }, [health, repo, today, refresh]);

  const setReminder = useCallback(
    async (settings: ReminderSettings) => {
      // Ask only when turning the reminder on: a refusal should leave the
      // stored preference off rather than claiming a reminder that will
      // never fire.
      if (settings.enabled && !(await reminderService.requestPermission())) {
        const off = { ...settings, enabled: false };
        const next = { ...prefs, reminder: off };
        setPrefs(next);
        await prefsStore.save(next);
        return false;
      }
      const next = { ...prefs, reminder: settings };
      setPrefs(next);
      await prefsStore.save(next);
      await reminderService.schedule(settings);
      return true;
    },
    [prefs, prefsStore, reminderService],
  );

  const completeOnboarding = useCallback(async () => {
    const next = { ...prefs, onboarded: true };
    setPrefs(next);
    await prefsStore.save(next);
  }, [prefs, prefsStore]);

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
    prefs,
    setReminder,
    completeOnboarding,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
