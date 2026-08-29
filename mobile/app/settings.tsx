/**
 * Settings.
 *
 * Two things matter here: the reminder that keeps the habit alive, and getting
 * the data off the device. The record is what people pay for, and it currently
 * lives in one place — losing a phone should not lose it.
 */
import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/ui/AppState';
import { Button, Card, SectionTitle } from '@/ui/components';
import { bandColors, colors, radius, spacing, type } from '@/ui/theme';
import { successFeedback, tapFeedback } from '@/ui/haptics';
import { exportBackup, parseBackup, restoreBackup } from '@/data/backup';
import { pickBackupText, shareBackup } from '@/data/backupFile';
import { PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '@/links';

/** Times people actually wake up. A full clock picker is overkill for this. */
const TIMES: { hour: number; minute: number }[] = [
  { hour: 5, minute: 30 },
  { hour: 6, minute: 0 },
  { hour: 6, minute: 30 },
  { hour: 7, minute: 0 },
  { hour: 7, minute: 30 },
  { hour: 8, minute: 0 },
  { hour: 9, minute: 0 },
];

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? 'am' : 'pm';
  return `${h}:${String(minute).padStart(2, '0')}${suffix}`;
}

export default function SettingsScreen() {
  const { prefs, setReminder, tier, repo, refresh } = useApp();
  const router = useRouter();
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function toggleReminder(enabled: boolean) {
    tapFeedback();
    setNote(undefined);
    const granted = await setReminder({ ...prefs.reminder, enabled });
    if (enabled && !granted) {
      setNote('Notifications are turned off for AthletIQ. Enable them in your device settings.');
    }
  }

  async function pickTime(hour: number, minute: number) {
    tapFeedback();
    await setReminder({ ...prefs.reminder, hour, minute });
  }

  async function onExport() {
    setBusy(true);
    setNote(undefined);
    try {
      const outcome = await shareBackup(await exportBackup(repo));
      if (outcome === 'unavailable') setNote('Sharing is not available on this device.');
    } catch {
      setNote('Could not create a backup file.');
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    setBusy(true);
    setNote(undefined);
    try {
      const text = await pickBackupText();
      if (!text) return;

      const { backup, skipped } = parseBackup(text);
      // Restore replaces everything, so this must be a deliberate confirmation.
      Alert.alert(
        'Replace all your data?',
        `This backup holds ${backup.checkIns.length} check-ins and ${backup.sessions.length} sessions. ` +
          'Restoring replaces everything currently on this device.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                const result = await restoreBackup(repo, backup);
                await refresh();
                successFeedback();
                setNote(
                  `Restored ${result.checkInsRestored} check-ins and ${result.sessionsRestored} sessions` +
                    (skipped > 0 ? `. ${skipped} unreadable records were skipped.` : '.'),
                );
              })();
            },
          },
        ],
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <SectionTitle>Morning reminder</SectionTitle>
      <Card>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.rowTitle}>Daily check-in</Text>
            <Text style={styles.rowNote}>
              One notification each morning. The record is only worth having if it is being fed.
            </Text>
          </View>
          <Switch
            value={prefs.reminder.enabled}
            onValueChange={(v) => void toggleReminder(v)}
            trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
            thumbColor={colors.text}
          />
        </View>

        {prefs.reminder.enabled && (
          <View style={styles.times}>
            {TIMES.map((t) => {
              const selected =
                prefs.reminder.hour === t.hour && prefs.reminder.minute === t.minute;
              return (
                <Pressable
                  key={`${t.hour}:${t.minute}`}
                  onPress={() => void pickTime(t.hour, t.minute)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.time, selected && styles.timeSelected]}
                >
                  <Text style={[styles.timeLabel, selected && styles.timeLabelSelected]}>
                    {formatTime(t.hour, t.minute)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card>
        <Text style={styles.rowNote}>
          Everything stays on this device. Export a backup so a lost phone does not take your
          history with it.
        </Text>
        <View style={styles.gap} />
        <Button label="Export a backup" variant="secondary" onPress={onExport} disabled={busy} />
        <View style={styles.gap} />
        <Button label="Restore from a backup" variant="ghost" onPress={onImport} disabled={busy} />
      </Card>

      {note && (
        <Card tone="sunken">
          <Text style={styles.note}>{note}</Text>
        </Card>
      )}

      <SectionTitle>Subscription</SectionTitle>
      <Card>
        <View style={styles.switchRow}>
          <Text style={styles.rowTitle}>Current plan</Text>
          <Text style={[styles.plan, tier !== 'free' && { color: bandColors.go }]}>
            {tier === 'free' ? 'Free' : tier === 'pro' ? 'Pro' : 'Coach'}
          </Text>
        </View>
        {tier === 'free' && (
          <>
            <View style={styles.gap} />
            <Button label="See AthletIQ Pro" onPress={() => router.push('/paywall')} />
          </>
        )}
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card>
        <LinkRow label="Support and FAQ" url={SUPPORT_URL} />
        <LinkRow label="Privacy policy" url={PRIVACY_URL} />
        <LinkRow label="Terms of use" url={TERMS_URL} />
      </Card>

      <Text style={styles.legal}>
        AthletIQ tracks training decisions. It is not a medical device and does not diagnose,
        treat, or predict injury.
      </Text>
    </ScrollView>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        void Linking.openURL(url);
      }}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={styles.linkRow}
    >
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.linkChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchText: { flex: 1, paddingRight: spacing.lg },
  rowTitle: { ...type.bodyStrong, color: colors.text },
  rowNote: { ...type.caption, color: colors.textTertiary, lineHeight: 19, marginTop: 2 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  time: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  timeSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  timeLabel: { ...type.caption, color: colors.textTertiary, fontWeight: '600' },
  timeLabelSelected: { color: colors.text },
  plan: { ...type.bodyStrong, color: colors.textSecondary },
  note: { ...type.caption, color: colors.text, lineHeight: 19 },
  legal: {
    ...type.caption,
    fontSize: 11,
    color: colors.textTertiary,
    lineHeight: 17,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  gap: { height: spacing.sm },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  linkLabel: { ...type.body, color: colors.text },
  linkChevron: { color: colors.textTertiary, fontSize: 22 },
});
