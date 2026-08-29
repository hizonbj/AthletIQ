/**
 * Paywall.
 *
 * The pitch is deliberately not "unlock your score" — the score is free, and
 * claiming otherwise invites the comparison with hardware we lose. It is that
 * the record of your own decisions is worth more the longer it runs.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/ui/AppState';
import { Button, Card } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';
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
      if (result.tier === 'pro') router.back();
      else setError('No previous purchase found on this account.');
    } catch {
      setError('Could not restore purchases.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your score is free. Always.</Text>
      <Text style={styles.sub}>
        What Pro adds is the part no one else keeps: a record of the days you trained through it,
        and what that did to you.
      </Text>

      <Card>
        {BENEFITS.map((b) => (
          <View key={b} style={styles.benefit}>
            <Text style={styles.tick}>✓</Text>
            <Text style={styles.benefitText}>{b}</Text>
          </View>
        ))}
      </Card>

      {plans.map((p) => (
        <Card key={p.id} style={selected === p.id ? styles.planSelected : undefined}>
          <View style={styles.planRow}>
            <View>
              <Text style={styles.planTitle}>{p.title}</Text>
              {p.badge && <Text style={styles.badge}>{p.badge}</Text>}
            </View>
            <Text style={styles.price}>{p.price}</Text>
          </View>
          <View style={styles.gap} />
          <Button
            label={selected === p.id ? 'Selected' : 'Choose'}
            variant="secondary"
            onPress={() => setSelected(p.id)}
          />
        </Card>
      ))}

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label={busy ? 'Working…' : 'Start Pro'} onPress={onPurchase} disabled={busy} />
      <View style={styles.gap} />
      <Button label="Restore purchase" variant="secondary" onPress={onRestore} disabled={busy} />

      <Text style={styles.legal}>
        AthletIQ tracks training decisions. It is not a medical device and does not diagnose,
        treat, or predict injury. Your data stays on your device.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: spacing.md },
  sub: {
    color: colors.textDim,
    fontSize: 16,
    lineHeight: 23,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  benefit: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tick: { color: '#3DD68C', fontSize: 16, fontWeight: '800' },
  benefitText: { color: colors.text, fontSize: 15, lineHeight: 21, flex: 1 },
  planSelected: { borderColor: colors.accent },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  badge: { color: colors.gold, fontSize: 12, fontWeight: '700', marginTop: 2 },
  price: { color: colors.text, fontSize: 20, fontWeight: '800' },
  error: { color: '#E5484D', fontSize: 14, marginBottom: spacing.md },
  legal: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  gap: { height: spacing.sm },
});
