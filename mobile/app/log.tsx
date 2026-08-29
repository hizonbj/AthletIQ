/**
 * Log a session.
 *
 * The intensity list draws the line where today's recommendation stops, so the
 * athlete sees the boundary before they cross it rather than being told after.
 * Crossing it is always allowed — this app records decisions, it does not
 * refuse them — but it is never accidental.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useApp } from '@/ui/AppState';
import { Button, Card, SectionTitle } from '@/ui/components';
import { IntensityPicker } from '@/ui/IntensityPicker';
import { DurationPicker } from '@/ui/DurationPicker';
import { bandColors, colors, radius, spacing, type } from '@/ui/theme';
import { INTENSITIES, intensityRank, type Intensity } from '@/domain/types';
import { checkBeforeSession, isLocked } from '@/domain/insights';
import type { PriorWarning } from '@/domain/override';
import type { ImportStatus } from '@/health/import';
import { warningFeedback } from '@/ui/haptics';

const IMPORT_MESSAGE: Record<ImportStatus, string> = {
  imported: '',
  'nothing-new': 'Nothing new to import — your entries already cover these days.',
  denied: 'Health access was declined. You can still enter everything by hand.',
  unavailable: 'Health data is not available on this device.',
};

export default function LogScreen() {
  const { today, addSession, repo, tier, insights, importHealth } = useApp();
  const router = useRouter();

  const [intensity, setIntensity] = useState<Intensity>();
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);

  const [isOverride, setIsOverride] = useState(false);
  const [warning, setWarning] = useState<PriorWarning>();
  const [warningLocked, setWarningLocked] = useState<string>();

  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string>();

  const ceiling = insights?.today.readiness.recommendedCeiling;
  const band = insights?.today.readiness.band ?? 'moderate';

  // Checked as soon as an intensity is picked, so the warning lands before the
  // session is saved, while it can still change the decision.
  useEffect(() => {
    if (!intensity) {
      setIsOverride(false);
      setWarning(undefined);
      setWarningLocked(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await checkBeforeSession(repo, tier, today, intensity);
      if (cancelled) return;
      setIsOverride(result.isOverride);
      if (result.isOverride) warningFeedback();
      if (isLocked(result.warning)) {
        setWarning(undefined);
        setWarningLocked(result.warning.reason);
      } else {
        setWarning(result.warning);
        setWarningLocked(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [intensity, repo, tier, today]);

  async function onImportHealth() {
    setImporting(true);
    setImportNote(undefined);
    try {
      const result = await importHealth();
      setImportNote(
        result.status === 'imported'
          ? `Filled in ${result.filledCount} value${result.filledCount === 1 ? '' : 's'} from Health.`
          : IMPORT_MESSAGE[result.status],
      );
    } catch {
      setImportNote('Could not read from Health.');
    } finally {
      setImporting(false);
    }
  }

  async function onSave() {
    if (!intensity) return;
    setSaving(true);
    await addSession({ date: today, intensity, durationMin: duration });
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <SectionTitle>How hard was it?</SectionTitle>
      <IntensityPicker
        value={intensity}
        ceiling={ceiling}
        bandColor={bandColors[band]}
        onChange={setIntensity}
      />

      <SectionTitle>How long?</SectionTitle>
      <DurationPicker value={duration} onChange={setDuration} />

      {isOverride && (
        <Animated.View entering={FadeInDown.duration(300)} layout={Layout}>
          <Card tone="accent" style={styles.warnCard}>
            <Text style={styles.warnTag}>Above today's recommendation</Text>
            {warning && <Text style={styles.warnBody}>{warning.message}</Text>}
            {warningLocked && <Text style={styles.warnBody}>{warningLocked}</Text>}
            {!warning && !warningLocked && (
              <Text style={styles.warnBody}>
                We will record this and tell you what it cost once the next few days are in.
              </Text>
            )}
            {warningLocked && (
              <>
                <View style={styles.gap} />
                <Button label="See AthletIQ Pro" onPress={() => router.push('/paywall')} />
              </>
            )}
          </Card>
        </Animated.View>
      )}

      <Animated.View layout={Layout} style={styles.actions}>
        <Button
          label={saving ? 'Saving…' : isOverride ? 'Log it anyway' : 'Log session'}
          onPress={onSave}
          disabled={!intensity || saving}
          tint={isOverride ? bandColors.easy : undefined}
        />
        <View style={styles.gap} />
        <Button
          label={importing ? 'Reading Health…' : 'Import sleep from Health'}
          variant="ghost"
          onPress={onImportHealth}
          disabled={importing}
        />
        {importNote && (
          <Animated.Text entering={FadeIn} style={styles.importNote}>
            {importNote}
          </Animated.Text>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  warnCard: { marginTop: spacing.lg },
  warnTag: { ...type.label, color: bandColors.easy, marginBottom: spacing.sm },
  warnBody: { ...type.body, color: colors.text, lineHeight: 23 },
  actions: { marginTop: spacing.xl },
  importNote: {
    ...type.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 19,
  },
  gap: { height: spacing.sm },
});
