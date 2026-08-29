/**
 * Patterns — the paid screen.
 *
 * Every override, what it cost, and the headline the athlete cannot get
 * anywhere else: across all of them, what pushing through has actually done to
 * them. Nothing here is simulated for free users; they see the lock instead.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/ui/AppState';
import { Card, LockedPanel, SectionTitle } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';
import { isLocked } from '@/domain/insights';
import type { OverrideOutcome } from '@/domain/override';

export default function PatternsScreen() {
  const { insights } = useApp();
  const router = useRouter();

  if (!insights) {
    return (
      <View style={styles.centered}>
        <Text style={styles.dim}>Loading…</Text>
      </View>
    );
  }

  if (isLocked(insights.pattern) || isLocked(insights.overrides)) {
    const reason = isLocked(insights.pattern)
      ? insights.pattern.reason
      : 'Your override log is part of AthletIQ Pro.';
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <LockedPanel reason={reason} onUpgrade={() => router.push('/paywall')} />
        <Card>
          <Text style={styles.explainTitle}>What you would see</Text>
          <Text style={styles.explain}>
            Every day you trained harder than your readiness endorsed, and what happened to your
            numbers in the three days after. Measured against your own baseline, not an average of
            other people.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  const { pattern, overrides } = insights;

  if (pattern.totalOverrides === 0) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <Text style={styles.headline}>No overrides yet.</Text>
          <Text style={styles.explain}>
            You have not trained above what your readiness endorsed. When you do, it lands here.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionTitle>The pattern</SectionTitle>
      <Card>
        {pattern.meanCost === undefined ? (
          <Text style={styles.explain}>
            {pattern.totalOverrides} override{pattern.totalOverrides === 1 ? '' : 's'} logged. We
            need a few more days of data before we can say what they cost.
          </Text>
        ) : pattern.meanCost > 0 ? (
          <>
            <Text style={styles.headline}>
              Pushing through costs you {pattern.meanCost} points.
            </Text>
            <Text style={styles.explain}>
              Across {pattern.settledCount} override{pattern.settledCount === 1 ? '' : 's'},
              your readiness in the days after sat {pattern.meanCost} points below your normal.{' '}
              {pattern.costlyCount} of them set you back.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.headline}>You handle it well.</Text>
            <Text style={styles.explain}>
              Across {pattern.settledCount} override{pattern.settledCount === 1 ? '' : 's'}, your
              readiness held steady afterwards. Your body is tolerating these sessions.
            </Text>
          </>
        )}
        {pattern.pendingCount > 0 && (
          <Text style={styles.pending}>
            {pattern.pendingCount} still settling — we need a few more days on those.
          </Text>
        )}
      </Card>

      <SectionTitle>Every override</SectionTitle>
      {[...overrides].reverse().map((o) => (
        <OverrideRow key={`${o.override.date}-${o.override.actual}`} outcome={o} />
      ))}
    </ScrollView>
  );
}

function OverrideRow({ outcome }: { outcome: OverrideOutcome }) {
  const { override } = outcome;
  const settled = outcome.status === 'settled';
  const cost = outcome.cost ?? 0;

  return (
    <Card>
      <View style={styles.rowTop}>
        <Text style={styles.date}>{override.date}</Text>
        {settled ? (
          <Text style={[styles.cost, { color: cost > 0 ? colors.gold : '#3DD68C' }]}>
            {cost > 0 ? `-${cost}` : `+${Math.abs(cost)}`}
          </Text>
        ) : (
          <Text style={styles.pendingTag}>settling</Text>
        )}
      </View>
      <Text style={styles.explain}>
        Readiness said <Text style={styles.strong}>{override.recommended}</Text> at{' '}
        {override.scoreAtOverride}. You went <Text style={styles.strong}>{override.actual}</Text>.
      </Text>
      {settled && (
        <Text style={styles.detail}>
          Your normal was {outcome.baselineScore}. The next days averaged{' '}
          {Math.round(outcome.postScore ?? 0)}.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headline: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.sm },
  explain: { color: colors.textDim, fontSize: 15, lineHeight: 21 },
  explainTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  detail: { color: colors.textDim, fontSize: 13, marginTop: spacing.sm },
  pending: { color: colors.textDim, fontSize: 13, marginTop: spacing.md, fontStyle: 'italic' },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  date: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cost: { fontSize: 18, fontWeight: '800' },
  pendingTag: { color: colors.textDim, fontSize: 12, textTransform: 'uppercase' },
  strong: { color: colors.text, fontWeight: '700' },
  dim: { color: colors.textDim, fontSize: 15 },
});
