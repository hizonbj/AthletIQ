/**
 * The morning check-in.
 *
 * One question per screen, each answered with a single tap that advances
 * automatically. The whole thing is four taps and one swipe, with no keyboard —
 * this is the interaction that happens every day, half awake, and everything
 * else in the app depends on it actually being done.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useApp } from '@/ui/AppState';
import { Button } from '@/ui/components';
import { SemanticScale } from '@/ui/SemanticScale';
import { SleepPicker } from '@/ui/SleepPicker';
import {
  colorForDownScale,
  colorForUpScale,
  ENERGY_WORDS,
  SLEEP_QUALITY_WORDS,
  SORENESS_WORDS,
} from '@/ui/checkInCopy';
import { colors, radius, spacing, type } from '@/ui/theme';
import { successFeedback, tapFeedback } from '@/ui/haptics';
import type { CheckIn } from '@/domain/types';

type StepId = 'sleep' | 'quality' | 'soreness' | 'energy';
const STEPS: StepId[] = ['sleep', 'quality', 'soreness', 'energy'];

const PROMPTS: Record<StepId, string> = {
  sleep: 'How long did you sleep?',
  quality: 'How well did you sleep?',
  soreness: 'How sore are you?',
  energy: 'How is your energy?',
};

/**
 * Where the sleep ruler starts. A typical night rather than the low end of the
 * scale: most people adjust from here by a few taps of scroll, and it means the
 * control shows a real value immediately instead of an inert dash.
 */
const DEFAULT_SLEEP_HOURS = 7.5;

export default function CheckInScreen() {
  const { today, saveCheckIn, insights, repo } = useApp();
  const router = useRouter();

  const alreadyCheckedIn = insights?.today.needsCheckIn === false;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CheckIn>({ date: today, sleepHours: DEFAULT_SLEEP_HOURS });
  const [saving, setSaving] = useState(false);

  // Redoing a check-in starts from what is already there, so correcting one
  // answer does not mean re-entering the other three.
  useEffect(() => {
    let cancelled = false;
    void repo.getCheckIn(today).then((existing) => {
      if (cancelled || !existing) return;
      setDraft((d) => ({
        ...existing,
        sleepHours: existing.sleepHours ?? d.sleepHours ?? DEFAULT_SLEEP_HOURS,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [repo, today]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // The sleep ruler has no discrete "answer" event, so it needs an explicit
  // Next; the tap scales advance themselves.
  const canAdvance = current !== 'sleep' || draft.sleepHours !== undefined;

  const advance = async (patch: Partial<CheckIn>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    setSaving(true);
    successFeedback();
    await saveCheckIn(next);
    router.replace('/');
  };

  const goBack = () => {
    tapFeedback();
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  };

  const progress = useMemo(
    () =>
      STEPS.map((id, i) => (
        <View
          key={id}
          style={[
            styles.pip,
            i === step && styles.pipActive,
            i < step && styles.pipDone,
          ]}
        />
      )),
    [step],
  );

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Pressable
          onPress={goBack}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={styles.pips}>{progress}</View>
        {/* Balances the back arrow so the pips stay centred. */}
        <View style={styles.backSpacer} />
      </View>

      <Animated.View
        key={current}
        entering={SlideInRight.duration(220)}
        exiting={SlideOutLeft.duration(160)}
        style={styles.body}
      >
        <Text style={styles.prompt}>{PROMPTS[current]}</Text>

        {current === 'sleep' && (
          <SleepPicker
            value={draft.sleepHours}
            onChange={(sleepHours) => setDraft((d) => ({ ...d, sleepHours }))}
          />
        )}

        {current === 'quality' && (
          <SemanticScale
            label="Sleep quality"
            words={SLEEP_QUALITY_WORDS}
            colorFor={colorForUpScale}
            value={draft.sleepQuality}
            onChange={(sleepQuality) => void advance({ sleepQuality })}
          />
        )}

        {current === 'soreness' && (
          <SemanticScale
            label="Soreness"
            words={SORENESS_WORDS}
            colorFor={colorForDownScale}
            value={draft.soreness}
            onChange={(soreness) => void advance({ soreness })}
          />
        )}

        {current === 'energy' && (
          <SemanticScale
            label="Energy"
            words={ENERGY_WORDS}
            colorFor={colorForUpScale}
            value={draft.energy}
            onChange={(energy) => void advance({ energy })}
          />
        )}
      </Animated.View>

      <View style={styles.footer}>
        {current === 'sleep' ? (
          <Button
            label={saving ? 'Saving…' : 'Next'}
            onPress={() => void advance({})}
            disabled={!canAdvance || saving}
          />
        ) : (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <Text style={styles.hint}>Tap an answer to continue</Text>
          </Animated.View>
        )}

        {alreadyCheckedIn && step === 0 && (
          <Text style={styles.hint}>Updating today's check-in.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  back: { color: colors.textSecondary, fontSize: 26, width: 44 },
  backSpacer: { width: 44 },
  pips: { flexDirection: 'row', gap: spacing.sm },
  pip: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceRaised,
  },
  pipActive: { backgroundColor: colors.accent },
  pipDone: { backgroundColor: colors.textTertiary },
  body: { flex: 1, justifyContent: 'center', paddingBottom: spacing.xl },
  prompt: {
    ...type.title,
    color: colors.text,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  footer: { paddingBottom: spacing.xxl, minHeight: 90, justifyContent: 'flex-end' },
  hint: {
    ...type.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
