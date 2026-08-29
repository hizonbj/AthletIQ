/**
 * Paywall.
 *
 * Leads with what stays free. Gating the score would invite the comparison
 * with hardware we lose, so the pitch is the one thing no wearable keeps: the
 * record of your own decisions and what they cost.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/ui/AppState';
import { Button } from '@/ui/components';
import { bandColors, colors, radius, spacing, type } from '@/ui/theme';
import { successFeedback, tapFeedback } from '@/ui/haptics';
import { PurchaseCancelledError, type SubscriptionPlan } from '@/subscription/store';

const BENEFITS = [
  'Every session you trained through a low score, on the record',
  'What each one actually cost you, in your own numbers',
  'A warning before the session, not a report after it',
  'Your full history, not just the last 7 days',
];

export default function PaywallScreen() {
  const { purchases, setTier } = useApp();
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    void purchases.getPlans().then((p) => {
      if (cancelled) return;
      setPlans(p);
      setSelected(p.find((x) => x.period === 'annual')?.id ?? p[0]?.id);
    });
    return () => {
      cancelled = true;
    };
  }, [purchases]);

  async function onPurchase() {
    if (!selected) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await purchases.purchase(selected);
      successFeedback();
      setTier(result.tier);
      router.back();
    } catch (e) {
      // Dismissing the store sheet is a choice, not a failure. Say nothing.
      if (!(e instanceof PurchaseCancelledError)) {
        setError(e instanceof Error ? e.message : 'Purchase failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await purchases.restore();
      setTier(result.tier);
      if (result.tier !== 'free') router.back();
      else setError('No previous purchase found on this account.');
    } catch {
      setError('Could not restore purchases.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.accentSoft, colors.bg]} style={styles.wash} />
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={16}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(320)}>
            <Text style={styles.title}>Your score is free.{'\n'}Always.</Text>
            <Text style={styles.sub}>
              What Pro adds is the part no one else keeps: a record of the days you trained through
              it, and what that did to you.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(320)} style={styles.benefits}>
            {BENEFITS.map((b) => (
              <View key={b} style={styles.benefit}>
                <View style={styles.tickWrap}>
                  <Text style={styles.tick}>✓</Text>
                </View>
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(320)}>
            {plans.map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                selected={selected === p.id}
                onSelect={() => {
                  tapFeedback();
                  setSelected(p.id);
                }}
              />
            ))}
          </Animated.View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <Button label={busy ? 'Working…' : 'Start Pro'} onPress={onPurchase} disabled={busy} />
            <Button label="Restore purchase" variant="ghost" onPress={onRestore} disabled={busy} />
          </View>

          <Text style={styles.legal}>
            AthletIQ tracks training decisions. It is not a medical device and does not diagnose,
            treat, or predict injury. Your data stays on your device.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PlanRow({
  plan,
  selected,
  onSelect,
}: {
  plan: SubscriptionPlan;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.plan, selected && styles.planSelected]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <View style={styles.planText}>
        <Text style={styles.planTitle}>{plan.title}</Text>
        {plan.badge && <Text style={styles.badge}>{plan.badge}</Text>}
      </View>
      <Text style={styles.price}>{plan.price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  safe: { flex: 1 },
  close: { alignSelf: 'flex-end', padding: spacing.lg },
  closeGlyph: { color: colors.textSecondary, fontSize: 20 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  title: { ...type.title, fontSize: 34, color: colors.text, lineHeight: 40 },
  sub: {
    ...type.body,
    color: colors.textSecondary,
    lineHeight: 24,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  benefits: { marginBottom: spacing.xl },
  benefit: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg, alignItems: 'center' },
  tickWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0F3328',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { color: bandColors.go, fontSize: 13, fontWeight: '800' },
  benefitText: { ...type.body, color: colors.text, lineHeight: 22, flex: 1 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  planSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  planText: { flex: 1 },
  planTitle: { ...type.bodyStrong, color: colors.text },
  badge: { ...type.label, color: bandColors.easy, marginTop: 2 },
  price: { ...type.heading, color: colors.text },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  error: { color: bandColors.rest, ...type.caption, marginBottom: spacing.md },
  legal: {
    ...type.caption,
    fontSize: 11,
    color: colors.textTertiary,
    lineHeight: 17,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
