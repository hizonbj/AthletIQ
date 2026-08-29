/**
 * Today. One number, what is dragging it down, and the two things you can do
 * about it. The score itself is free forever — it is the record of what you do
 * with it that Pro sells.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useApp } from '@/ui/AppState';
import { Button, Card, ReadinessRing, SectionTitle } from '@/ui/components';
import { bandColors, bandCopy, colors, spacing } from '@/ui/theme';
import { isLocked } from '@/domain/insights';
import { hasFeature } from '@/subscription/entitlements';

export default function TodayScreen() {
  const { insights, ready, refresh, tier } = useApp();
  const router = useRouter();

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!ready || !insights) {
    return (
      <View style={styles.centered}>
        <Text style={styles.dim}>Loading…</Text>
      </View>
    );
  }

  const { readiness, needsCheckIn } = insights.today;
  const copy = bandCopy[readiness.band];
  const hasData = readiness.confidence > 0;
  const lowConfidence = hasData && readiness.confidence < 0.4;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.ringWrap}>
        <ReadinessRing score={readiness.score} band={readiness.band} hasData={hasData} />
        {hasData ? (
          <>
            <Text style={[styles.bandTitle, { color: bandColors[readiness.band] }]}>
              {copy.title}
            </Text>
            <Text style={styles.bandDetail}>{copy.detail}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.bandTitle, { color: colors.textDim }]}>No reading yet</Text>
            <Text style={styles.bandDetail}>
              Check in and this becomes a number that means something.
            </Text>
          </>
        )}
      </View>

      {needsCheckIn && (
        <Card>
          <Text style={styles.cardBody}>
            You have not checked in today. Two taps makes this number mean something.
          </Text>
          <View style={styles.gap} />
          <Button label="Check in" onPress={() => router.push('/log')} />
        </Card>
      )}

      {!needsCheckIn && lowConfidence && (
        <Card>
          <Text style={styles.cardBody}>
            This score is based on partial data — {Math.round(readiness.confidence * 100)}% of the
            signals we use. Treat it as a rough read.
          </Text>
        </Card>
      )}

      {readiness.limiters.length > 0 && (
        <>
          <SectionTitle>What is holding you back</SectionTitle>
          <Card>
            {readiness.limiters.map((l, i) => (
              <View key={l.key} style={[styles.row, i > 0 && styles.rowDivided]}>
                <Text style={styles.rowLabel}>{l.label}</Text>
                <Text style={styles.rowValue}>{l.display}</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {insights.history.length > 0 && (
        <>
          <SectionTitle>
            Last {insights.history.length} day{insights.history.length === 1 ? '' : 's'}
          </SectionTitle>
          <Card>
            <Sparkline points={insights.history.map((h) => h.score)} />
            {insights.historyTruncated && (
              <Text style={styles.truncated}>
                Free shows 7 days. Pro shows everything you have logged.
              </Text>
            )}
          </Card>
        </>
      )}

      <Button label="Log a session" onPress={() => router.push('/log')} />
      <View style={styles.gap} />
      <Button
        label={isLocked(insights.pattern) ? 'See your override patterns' : 'Your patterns'}
        variant="secondary"
        onPress={() => router.push('/patterns')}
      />
      {hasFeature(tier, 'roster') && (
        <>
          <View style={styles.gap} />
          <Button label="Your squad" variant="secondary" onPress={() => router.push('/roster')} />
        </>
      )}
      {tier === 'free' && <Text style={styles.footnote}>Free plan</Text>}
    </ScrollView>
  );
}

/** Bar sparkline. Bars, not a line: the days are discrete and often have gaps. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length === 0) {
    return <Text style={styles.dim}>Nothing logged yet.</Text>;
  }
  return (
    <View style={styles.spark}>
      {points.map((p, i) => (
        <View
          key={i}
          style={[
            styles.sparkBar,
            { height: Math.max(4, (p / 100) * 60), backgroundColor: barColor(p) },
          ]}
        />
      ))}
    </View>
  );
}

function barColor(score: number): string {
  if (score < 40) return bandColors.rest;
  if (score < 60) return bandColors.easy;
  if (score < 80) return bandColors.moderate;
  return bandColors.go;
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringWrap: { alignItems: 'center', marginVertical: spacing.lg },
  bandTitle: { fontSize: 26, fontWeight: '800', marginTop: spacing.md },
  bandDetail: {
    color: colors.textDim,
    fontSize: 15,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  cardBody: { color: colors.text, fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { color: colors.text, fontSize: 15 },
  rowValue: { color: colors.textDim, fontSize: 15 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 60 },
  sparkBar: { flex: 1, borderRadius: 2, minWidth: 6 },
  truncated: { color: colors.textDim, fontSize: 13, marginTop: spacing.md },
  gap: { height: spacing.sm },
  dim: { color: colors.textDim, fontSize: 15 },
  footnote: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
