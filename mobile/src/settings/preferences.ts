/**
 * Preference persistence, and the merge that protects against a partial or
 * outdated stored shape.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_REMINDER,
  type Preferences,
  type PreferencesStore,
} from './types';

const KEY = 'athletiq.prefs.v1';

/**
 * Merge stored preferences over the defaults.
 *
 * Anything missing, malformed, or out of range falls back rather than
 * propagating: a corrupt stored hour must not schedule a notification at an
 * impossible time or crash the first render.
 */
export function mergePreferences(raw: unknown): Preferences {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_PREFERENCES;
  const input = raw as Partial<Preferences>;
  const reminder = input.reminder;

  const hour =
    typeof reminder?.hour === 'number' && Number.isInteger(reminder.hour) &&
    reminder.hour >= 0 && reminder.hour <= 23
      ? reminder.hour
      : DEFAULT_REMINDER.hour;

  const minute =
    typeof reminder?.minute === 'number' && Number.isInteger(reminder.minute) &&
    reminder.minute >= 0 && reminder.minute <= 59
      ? reminder.minute
      : DEFAULT_REMINDER.minute;

  return {
    onboarded: input.onboarded === true,
    reminder: { enabled: reminder?.enabled === true, hour, minute },
  };
}

export class AsyncStoragePreferences implements PreferencesStore {
  async load(): Promise<Preferences> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      return mergePreferences(raw ? JSON.parse(raw) : null);
    } catch {
      // Unreadable or corrupt storage must not block the app from starting.
      return DEFAULT_PREFERENCES;
    }
  }

  async save(prefs: Preferences): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // Best effort: failing to persist a preference is not worth a crash.
    }
  }
}

/** In-memory store for tests and previews. */
export class MemoryPreferences implements PreferencesStore {
  constructor(private prefs: Preferences = DEFAULT_PREFERENCES) {}

  async load(): Promise<Preferences> {
    return this.prefs;
  }

  async save(prefs: Preferences): Promise<void> {
    this.prefs = prefs;
  }
}
