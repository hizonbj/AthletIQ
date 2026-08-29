/**
 * expo-notifications implementation.
 *
 * Requires a development build; local notifications do not work in Expo Go on
 * Android and are unavailable on web.
 */
import * as Notifications from 'expo-notifications';
import type { ReminderSettings } from '@/settings/types';
import { reminderCopyForDay } from './copy';
import type { Reminders } from './types';

const CHANNEL_ID = 'daily-check-in';

export class ExpoReminders implements Reminders {
  async requestPermission(): Promise<boolean> {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    // Only prompt when we can: asking again after a denial does nothing on iOS.
    if (!existing.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  }

  async schedule(settings: ReminderSettings): Promise<void> {
    // Always clear first: rescheduling must replace, never stack.
    await this.cancel();
    if (!settings.enabled) return;

    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Daily check-in',
      importance: Notifications.AndroidImportance.DEFAULT,
    });

    const copy = reminderCopyForDay(Math.floor(Date.now() / 86_400_000));
    await Notifications.scheduleNotificationAsync({
      content: { title: copy.title, body: copy.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.hour,
        minute: settings.minute,
        channelId: CHANNEL_ID,
      },
    });
  }

  async cancel(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}
