/**
 * First run.
 *
 * A new athlete opening to a dash and an empty ring has no idea what this is
 * or why it is different from the recovery score already on their wrist. Three
 * screens to land the premise, then straight into the first check-in — the
 * intro is not the product and should not outstay its welcome.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/ui/AppState';
import { Button } from '@/ui/components';
import { bandColors, colors, spacing, type } from '@/ui/theme';
import { tapFeedback } from '@/ui/haptics';

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    eyebrow: 'Every morning',
    title: 'One number, in twenty seconds.',
    body: 'Four taps about your night. We turn them into a readiness score and tell you what today is actually good for.',
    accent: bandColors.moderate,
  },
  {
    eyebrow: 'The part nobody else keeps',
    title: 'What happens when you ignore it.',
    body: 'Train hard on a day your score said back off and we record it. A few days later we settle up: what that decision cost you, measured against your own normal.',
    accent: bandColors.easy,
  },
  {
    eyebrow: 'Over time',
    title: 'Your own evidence.',
    body: 'After a handful of these you stop guessing. You know whether pushing through works for you, because you have the record.',
    accent: bandColors.go,
  },
];

export default function OnboardingScreen() {
  const { completeOnboarding, setReminder, prefs } = useApp();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  async function finish(withReminder: boolean) {
    setBusy(true);
    if (withReminder) {
      await setReminder({ ...prefs.reminder, enabled: true });
    }
    await completeOnboarding();
    router.replace('/checkin');
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={[`${slide.accent}22`, colors.bg]} style={styles.wash} />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.top}>
          <View style={styles.pips}>
            {SLIDES.map((s, i) => (
              <View
                key={s.title}
                style={[styles.pip, i === index && { backgroundColor: slide.accent, width: 28 }]}
              />
            ))}
          </View>
          {!isLast && (
            <Pressable
              onPress={() => void finish(false)}
              hitSlop={12}
              accessibilityRole="button"
            >
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          )}
        </View>

        <Animated.View
          key={slide.title}
          entering={FadeIn.duration(280)}
          exiting={FadeOut.duration(140)}
          style={styles.body}
        >
          <Text style={[styles.eyebrow, { color: slide.accent }]}>{slide.eyebrow}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.copy}>{slide.body}</Text>
        </Animated.View>

        <View style={styles.footer}>
          {isLast ? (
            <>
              <Button
                label={busy ? 'Setting up…' : 'Remind me each morning'}
                onPress={() => void finish(true)}
                disabled={busy}
                tint={slide.accent}
              />
              <Button
                label="Not now"
                variant="ghost"
                onPress={() => void finish(false)}
                disabled={busy}
              />
            </>
          ) : (
            <Button
              label="Next"
              tint={slide.accent}
              onPress={() => {
                tapFeedback();
                setIndex((i) => i + 1);
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
  },
  pips: { flexDirection: 'row', gap: spacing.sm },
  pip: { width: 8, height: 4, borderRadius: 2, backgroundColor: colors.surfaceRaised },
  skip: { ...type.body, color: colors.textTertiary },
  body: { flex: 1, justifyContent: 'center' },
  eyebrow: { ...type.label, marginBottom: spacing.md },
  title: { ...type.title, fontSize: 34, color: colors.text, lineHeight: 40 },
  copy: {
    ...type.body,
    fontSize: 17,
    color: colors.textSecondary,
    lineHeight: 26,
    marginTop: spacing.lg,
  },
  footer: { paddingBottom: spacing.lg, gap: spacing.sm },
});
