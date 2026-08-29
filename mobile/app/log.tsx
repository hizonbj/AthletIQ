/**
 * Check in, then log the session.
 *
 * The important moment on this screen is choosing an intensity above what today
 * endorses. That is where the warning fires — before the session, while it can
 * still change the decision, rather than in a report a week later.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/ui/AppState';
import { Button, Card, Chip, SectionTitle } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';
import { INTENSITIES, type Intensity } from '@/domain/types';
import { checkBeforeSession, isLocked } from '@/domain/insights';
import type { PriorWarning } from '@/domain/override';

export default function LogScreen() {
  const { today, saveCheckIn, addSession, repo, tier, insights } = useApp();
  const router = useRouter();

  const [sleepHours, setSleepHours] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [sleepQuality, setSleepQuality] = useState<number>();
  const [soreness, setSoreness] = useState<number>();
  const [energy, setEnergy] = useState<number>();

  const [intensity, setIntensity] = useState<Intensity>();
  const [duration, setDuration] = useState('60');

  const [isOverride, setIsOverride] = useState(false);
  const [warning, setWarning] = useState<PriorWarning>();
  const [warningLocked, setWarningLocked] = useState<string>();

  // Re-check as soon as an intensity is picked, so the warning lands before the
  // session is saved rather than after.
  useEffect(() => {
    if (!intensity) {
      setIsOverride(false);
      setWarning(undefined);
      setWarningLocked(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await checkBeforeSession(repo, tier, today, intensity);
      if (cancelled) return;
      setIsOverride(result.isOverride);
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

  const parseOptional = (v: string): number | undefined => {
    const n = Number(v);
    return v.trim() !== '' && Number.isFinite(n) ? n : undefined;
  };

  async function onSaveCheckIn() {
    await saveCheckIn({
      date: today,
      sleepHours: parseOptional(sleepHours),
      restingHr: parseOptional(restingHr),
      sleepQuality,
      soreness,
      energy,
    });
  }

  async function onSaveSession() {
    if (!intensity) return;
    await addSession({
      date: today,
      intensity,
      durationMin: parseOptional(duration) ?? 0,
    });
    router.back();
  }

  const ceiling = insights?.today.readiness.recommendedCeiling;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <SectionTitle>This morning</SectionTitle>
      <Card>
        <LabeledInput
          label="Sleep (hours)"
          value={sleepHours}
          onChangeText={setSleepHours}
          placeholder="7.5"
        />
        <LabeledInput
          label="Resting HR (bpm)"
          value={restingHr}
          onChangeText={setRestingHr}
          placeholder="52"
        />
        <Scale label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
        <Scale label="Soreness" value={soreness} onChange={setSoreness} hint="5 = very sore" />
        <Scale label="Energy" value={energy} onChange={setEnergy} />
        <View style={styles.gap} />
        <Button label="Save check-in" onPress={onSaveCheckIn} variant="secondary" />
      </Card>

      <SectionTitle>Session</SectionTitle>
      <Card>
        <Text style={styles.label}>Intensity</Text>
        <View style={styles.chips}>
          {INTENSITIES.map((i) => (
            <Chip key={i} label={i} selected={intensity === i} onPress={() => setIntensity(i)} />
          ))}
        </View>
        {ceiling && (
          <Text style={styles.hint}>Today endorses up to: {ceiling}</Text>
        )}
        <View style={styles.gap} />
        <LabeledInput
          label="Duration (minutes)"
          value={duration}
          onChangeText={setDuration}
          placeholder="60"
        />
      </Card>

      {isOverride && (
        <Card style={styles.warnCard}>
          <Text style={styles.warnTitle}>This is above what today endorses</Text>
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
              <Button
                label="See AthletIQ Pro"
                variant="secondary"
                onPress={() => router.push('/paywall')}
              />
            </>
          )}
        </Card>
      )}

      <Button
        label={isOverride ? 'Log it anyway' : 'Log session'}
        onPress={onSaveSession}
        disabled={!intensity}
      />
    </ScrollView>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
      />
    </View>
  );
}

function Scale({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value?: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {hint ? <Text style={styles.hintInline}> · {hint}</Text> : null}
      </Text>
      <View style={styles.chips}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Chip key={n} label={String(n)} selected={value === n} onPress={() => onChange(n)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  field: { marginBottom: spacing.md },
  label: { color: colors.text, fontSize: 14, marginBottom: spacing.sm, fontWeight: '600' },
  hintInline: { color: colors.textDim, fontWeight: '400' },
  hint: { color: colors.textDim, fontSize: 13, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  warnCard: { borderColor: colors.gold },
  warnTitle: { color: colors.gold, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  warnBody: { color: colors.text, fontSize: 15, lineHeight: 21 },
  gap: { height: spacing.sm },
});
