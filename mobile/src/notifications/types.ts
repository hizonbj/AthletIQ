/**
 * Reminder scheduling.
 *
 * A daily-ritual app with no reminder loses the habit, and the habit is the
 * product: the override record is only worth paying for if it is being fed.
 * Local notifications, so this needs no server and no account.
 */
import type { ReminderSettings } from '@/settings/types';

export interface Reminders {
  /** Prompt for permission. Returns whether it was granted. */
  requestPermission(): Promise<boolean>;
  /** Replace any existing reminder with one at this time. */
  schedule(settings: ReminderSettings): Promise<void>;
  cancel(): Promise<void>;
}

/** Used on web and wherever notifications are unavailable. */
export class NoopReminders implements Reminders {
  async requestPermission(): Promise<boolean> {
    return false;
  }
  async schedule(): Promise<void> {}
  async cancel(): Promise<void> {}
}
