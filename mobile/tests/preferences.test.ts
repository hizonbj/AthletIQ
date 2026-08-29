import { describe, expect, it } from 'vitest';
import { mergePreferences, MemoryPreferences } from '@/settings/preferences';
import { DEFAULT_PREFERENCES } from '@/settings/types';
import { reminderCopyForDay, REMINDER_BODIES, REMINDER_TITLES } from '@/notifications/copy';

describe('mergePreferences', () => {
  it('falls back to defaults for missing or non-object input', () => {
    expect(mergePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(mergePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(mergePreferences('nonsense')).toEqual(DEFAULT_PREFERENCES);
    expect(mergePreferences(42)).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps a valid stored reminder', () => {
    const prefs = mergePreferences({
      onboarded: true,
      reminder: { enabled: true, hour: 6, minute: 30 },
    });
    expect(prefs).toEqual({ onboarded: true, reminder: { enabled: true, hour: 6, minute: 30 } });
  });

  it('rejects an out-of-range hour rather than scheduling at an impossible time', () => {
    expect(mergePreferences({ reminder: { enabled: true, hour: 25, minute: 0 } }).reminder.hour)
      .toBe(DEFAULT_PREFERENCES.reminder.hour);
    expect(mergePreferences({ reminder: { enabled: true, hour: -1, minute: 0 } }).reminder.hour)
      .toBe(DEFAULT_PREFERENCES.reminder.hour);
  });

  it('rejects an out-of-range or fractional minute', () => {
    expect(mergePreferences({ reminder: { enabled: true, hour: 7, minute: 60 } }).reminder.minute)
      .toBe(0);
    expect(mergePreferences({ reminder: { enabled: true, hour: 7, minute: 12.5 } }).reminder.minute)
      .toBe(0);
  });

  it('treats a non-boolean enabled flag as off', () => {
    // A truthy string must not silently enable notifications.
    expect(mergePreferences({ reminder: { enabled: 'yes', hour: 7, minute: 0 } }).reminder.enabled)
      .toBe(false);
    expect(mergePreferences({ onboarded: 'yes' }).onboarded).toBe(false);
  });

  it('accepts partial input, filling only what is missing', () => {
    const prefs = mergePreferences({ onboarded: true });
    expect(prefs.onboarded).toBe(true);
    expect(prefs.reminder).toEqual(DEFAULT_PREFERENCES.reminder);
  });

  it('preserves minute 0, which is falsy and easy to drop', () => {
    expect(mergePreferences({ reminder: { enabled: true, hour: 0, minute: 0 } }))
      .toEqual({ onboarded: false, reminder: { enabled: true, hour: 0, minute: 0 } });
  });
});

describe('MemoryPreferences', () => {
  it('round-trips a save', async () => {
    const store = new MemoryPreferences();
    expect((await store.load()).onboarded).toBe(false);
    await store.save({ onboarded: true, reminder: { enabled: true, hour: 8, minute: 15 } });
    const loaded = await store.load();
    expect(loaded.onboarded).toBe(true);
    expect(loaded.reminder.hour).toBe(8);
  });
});

describe('reminderCopyForDay', () => {
  it('is deterministic for a given day', () => {
    expect(reminderCopyForDay(5)).toEqual(reminderCopyForDay(5));
  });

  it('varies across consecutive days so it does not become wallpaper', () => {
    expect(reminderCopyForDay(0).title).not.toBe(reminderCopyForDay(1).title);
  });

  it('stays in range for any day index, including negative', () => {
    for (const d of [0, 1, 7, 1000, -3, -20250829]) {
      const copy = reminderCopyForDay(d);
      expect(REMINDER_TITLES).toContain(copy.title);
      expect(REMINDER_BODIES).toContain(copy.body);
    }
  });
});
