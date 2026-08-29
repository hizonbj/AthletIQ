/**
 * Patterns — the paid screen.
 *
 * The headline is a sentence about the athlete, not a metric: "pushing through
 * costs you 12 points" is the entire product in six words. Everything below is
 * the evidence for it, one override at a time.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { useApp } from '@/ui/AppState';
import { Card, LockedPanel, SectionTitle } from '@/ui/components';
import { bandColors, colors, radius, spacing, type, TAB_BAR_CLEARANCE } from '@/ui/theme';
import { isLocked } from '@/domain/insights';
import type { OverrideOutcome } from '@/domain/override';

export default function PatternsScreen() {
  const { insights, refresh } = useApp();
  const router = useRouter();

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
    }, [refresh]),
  );

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
        <Card tone="sunken">
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

  const costly = pattern.meanCost !== undefined && pattern.meanCost > 0;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(360)}>
        <Card style={[styles.hero, costly && { borderColor: bandColors.easy }]}>
          {pattern.meanCost === undefined ? (
            <>
              <Text style={styles.headline}>Still settling.</Text>
              <Text style={styles.explain}>
                {pattern.totalOverrides} override{pattern.totalOverrides === 1 ? '' : 's'} logged.
                We need a few more days of data before we can say what they cost.
              </Text>
            </>
          ) : costly ? (
            <>
              <Text style={styles.heroNumber}>−{pattern.meanCost}</Text>
              <Text style={styles.headline}>Pushing through costs you.</Text>
              <Text style={styles.explain}>
                Across {pattern.settledCount} override{pattern.settledCount === 1 ? '' : 's'}, your
                readiness in the days after sat {pattern.meanCost} points below your normal.{' '}
                {pattern.costlyCount} of them set you back.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.heroNumber, { color: bandColors.go }]}>
                +{Math.abs(pattern.meanCost)}
              </Text>
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
      </Animated.View>

      <SectionTitle>Every override</SectionTitle>
      {[...overrides].reverse().map((o, i) => (
        <Animated.View
          key={`${o.override.date}-${o.override.actual}`}
          entering={FadeInDown.delay(60 + i * 40).duration(300)}
        >
          <OverrideRow outcome={o} />
        </Animated.View>
      ))}
    </ScrollView>
  );
}

function OverrideRow({ outcome }: { outcome: OverrideOutcome }) {
  const { override } = outcome;
  const settled = outcome.status === 'settled';
  const cost = outcome.cost ?? 0;
  const hurt = cost > 0;

  return (
    <Card style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.date}>{formatDate(override.date)}</Text>
        {settled ? (
          <View style={[styles.costPill, { backgroundColor: hurt ? '#3A2A14' : '#0F3328' }]}>
            <Text style={[styles.cost, { color: hurt ? bandColors.easy : bandColors.go }]}>
              {hurt ? `−${cost}` : `+${Math.abs(cost)}`}
            </Text>
          </View>
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

function formatDate(iso: string): string {
  const [, month, day] = iso.split('-');
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[Number(month) - 1]} ${Number(day)}`;
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: TAB_BAR_CLEARANCE },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  hero: { paddingVertical: spacing.xl },
  heroNumber: {
    ...type.display,
    fontSize: 56,
    color: bandColors.easy,
    marginBottom: spacing.xs,
  },
  headline: { ...type.title, color: colors.text, marginBottom: spacing.sm },
  explain: { ...type.body, color: colors.textSecondary, lineHeight: 23 },
  explainTitle: { ...type.heading, color: colors.text, marginBottom: spacing.sm },
  detail: { ...type.caption, color: colors.textTertiary, marginTop: spacing.sm },
  pending: { ...type.caption, color: colors.textTertiary, marginTop: spacing.lg },
  row: { paddingVertical: spacing.md },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  date: { ...type.bodyStrong, color: colors.text },
  costPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  cost: { ...type.bodyStrong, fontWeight: '800' },
  pendingTag: { ...type.label, color: colors.textTertiary },
  strong: { color: colors.text, fontWeight: '700', textTransform: 'capitalize' },
  dim: { ...type.body, color: colors.textTertiary },
});
