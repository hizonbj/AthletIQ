/**
 * User preferences.
 *
 * Kept behind an interface for the same reason as storage and purchases: the
 * app should be testable without a device, and settings are read on the very
 * first render.
 */
export interface ReminderSettings {
  enabled: boolean;
  /** 24-hour local time, e.g. 7 for 07:00. */
  hour: number;
  minute: number;
}

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 7, minute: 0 };

export interface Preferences {
  reminder: ReminderSettings;
  /** False until the athlete has been through the intro. */
  onboarded: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  reminder: DEFAULT_REMINDER,
  onboarded: false,
};

export interface PreferencesStore {
  load(): Promise<Preferences>;
  save(prefs: Preferences): Promise<void>;
}
