/**
 * Today.
 *
 * A single answer, delivered before anything has to be read: the ring's colour
 * is the verdict, the number is the detail, and the primary action changes to
 * whatever this athlete has not done yet. Everything below the fold is
 * supporting evidence for the number above it.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/ui/AppState';
import { Button, Card, SectionTitle } from '@/ui/components';
import { ReadinessRing } from '@/ui/ReadinessRing';
import { Trend } from '@/ui/Trend';
import { bandColors, bandColorsDim, bandCopy, colors, spacing, type, TAB_BAR_CLEARANCE } from '@/ui/theme';
import type { Readiness } from '@/domain/types';

export default function TodayScreen() {
  const { insights, ready, refresh } = useApp();
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
  const hasData = readiness.confidence > 0;
  const band = readiness.band;
  const copy = bandCopy[band];
  const lowConfidence = hasData && readiness.confidence < 0.4;

  return (
    <View style={styles.root}>
      {/* A wash of the band colour behind the ring: the verdict reaches the
          eye before the ring resolves. */}
      <LinearGradient
        colors={[hasData ? bandColorsDim[band] : colors.surface, colors.bg]}
        style={styles.wash}
        pointerEvents="none"
      />

      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.greeting}>{greeting()}</Text>

          <View style={styles.ringWrap}>
            <ReadinessRing score={readiness.score} band={band} hasData={hasData} />
          </View>

          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.verdict}>
            <Text style={[styles.band, { color: hasData ? bandColors[band] : colors.textTertiary }]}>
              {hasData ? copy.title : 'No reading yet'}
            </Text>
            <Text style={styles.verdictDetail}>
              {hasData ? copy.detail : 'Check in and this becomes a number that means something.'}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            {needsCheckIn ? (
              <Button
                label="Check in — takes 20 seconds"
                onPress={() => router.push('/checkin')}
                tint={hasData ? bandColors[band] : undefined}
              />
            ) : (
              <Button
                label="Log a session"
                onPress={() => router.push('/log')}
                tint={bandColors[band]}
              />
            )}
            {!needsCheckIn && (
              <>
                <View style={styles.gap} />
                <Button
                  label="Redo check-in"
                  variant="ghost"
                  onPress={() => router.push('/checkin')}
                />
              </>
            )}
          </Animated.View>

          {lowConfidence && (
            <Card tone="sunken" style={styles.spacedTop}>
              <Text style={styles.note}>
                Based on {Math.round(readiness.confidence * 100)}% of the signals we use. Treat it
                as a rough read.
              </Text>
            </Card>
          )}

          {hasData && readiness.limiters.length > 0 && (
            <View style={styles.spacedTop}>
              <SectionTitle>Holding you back</SectionTitle>
              {readiness.limiters.map((l) => (
                <Limiter key={l.key} limiter={l} />
              ))}
            </View>
          )}

          {insights.history.length > 1 && (
            <View style={styles.spacedTop}>
              <SectionTitle>
                Last {insights.history.length} days
              </SectionTitle>
              <Card>
                <Trend points={insights.history} />
                {insights.historyTruncated && (
                  <Text style={styles.truncated}>
                    Free shows 7 days. Pro shows everything you have logged.
                  </Text>
                )}
              </Card>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Limiter({ limiter }: { limiter: Readiness['limiters'][number] }) {
  // The bar length is the signal's own quality, so a glance ranks them.
  const pct = Math.round(limiter.normalized * 100);
  return (
    <Card style={styles.limiterCard}>
      <View style={styles.limiterTop}>
        <Text style={styles.limiterLabel}>{limiter.label}</Text>
        <Text style={styles.limiterValue}>{limiter.display}</Text>
      </View>
      <View style={styles.limiterTrack}>
        <View
          style={[
            styles.limiterFill,
            { width: `${Math.max(4, pct)}%`, backgroundColor: severityColor(limiter.normalized) },
          ]}
        />
      </View>
    </Card>
  );
}

function severityColor(normalized: number): string {
  if (normalized < 0.25) return bandColors.rest;
  if (normalized < 0.5) return bandColors.easy;
  return bandColors.moderate;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 460 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: TAB_BAR_CLEARANCE },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  greeting: { ...type.label, color: colors.textTertiary, marginTop: spacing.md },
  ringWrap: { alignItems: 'center', marginTop: spacing.lg },
  verdict: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  band: { ...type.title, fontSize: 32 },
  verdictDetail: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 23,
    paddingHorizontal: spacing.lg,
  },
  spacedTop: { marginTop: spacing.xl },
  note: { ...type.caption, color: colors.textSecondary, lineHeight: 19 },
  limiterCard: { paddingVertical: spacing.md },
  limiterTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  limiterLabel: { ...type.bodyStrong, color: colors.text },
  limiterValue: { ...type.body, color: colors.textTertiary },
  limiterTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  limiterFill: { height: 6, borderRadius: 3 },
  truncated: { ...type.caption, color: colors.textTertiary, marginTop: spacing.md },
  gap: { height: spacing.sm },
  dim: { ...type.body, color: colors.textTertiary },
});
