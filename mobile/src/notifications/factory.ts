/** Picks the reminder backend for the current platform. */
import { Platform } from 'react-native';
import { NoopReminders, type Reminders } from './types';
import { ExpoReminders } from './expoReminders';

export function createReminders(): Reminders {
  return Platform.OS === 'web' ? new NoopReminders() : new ExpoReminders();
}
