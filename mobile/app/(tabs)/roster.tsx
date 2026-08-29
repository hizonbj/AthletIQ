/**
 * Coach roster — the morning worklist.
 *
 * Sorted by who needs a conversation first, not alphabetically and not by
 * score. A coach with twenty athletes reads the top three and moves on.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/ui/AppState';
import { Card, LockedPanel, SectionTitle, Stat } from '@/ui/components';
import { bandColors, colors, spacing, type, TAB_BAR_CLEARANCE } from '@/ui/theme';
import { buildRoster, type RosterEntry, type RosterStatus, type RosterView } from '@/domain/roster';
import { hasFeature } from '@/subscription/entitlements';

const STATUS_COLOR: Record<RosterStatus, string> = {
  flag: bandColors.rest,
  watch: bandColors.easy,
  stale: colors.textTertiary,
  ok: bandColors.go,
};

const STATUS_LABEL: Record<RosterStatus, string> = {
  flag: 'Talk to them',
  watch: 'Watch',
  stale: 'No data',
  ok: 'Good',
};

export default function RosterScreen() {
  const { tier, rosterRepo, today } = useApp();
  const router = useRouter();
  const [view, setView] = useState<RosterView>();

  const entitled = hasFeature(tier, 'roster');

  useEffect(() => {
    if (!entitled) return;
    let cancelled = false;
    void rosterRepo.getSquad().then((squad) => {
      if (!cancelled) setView(buildRoster(squad, today));
    });
    return () => {
      cancelled = true;
    };
  }, [entitled, rosterRepo, today]);

  if (!entitled) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <LockedPanel
          reason="The roster is part of AthletIQ for Coaches."
          onUpgrade={() => router.push('/paywall')}
        />
        <Card>
          <Text style={styles.explainTitle}>What you would see</Text>
          <Text style={styles.explain}>
            Your whole squad each morning, sorted by who needs you first — who is asking for a day
            off, who keeps training through it, and who has stopped checking in. Plus a record of
            what each athlete was told, and when.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  if (!view) {
    return (
      <View style={styles.centered}>
        <Text style={styles.dim}>Loading squad…</Text>
      </View>
    );
  }

  if (view.entries.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <Text style={styles.headline}>No athletes yet.</Text>
          <Text style={styles.explain}>Add your squad and their mornings land here.</Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.summary}>
        <Stat value={String(view.flagged)} label="to talk to" color={bandColors.rest} />
        <Stat value={String(view.watched)} label="to watch" color={bandColors.easy} />
        <Stat
          value={view.teamAverage === undefined ? '--' : String(view.teamAverage)}
          label="squad avg"
          color={colors.text}
        />
      </View>

      <SectionTitle>
        {view.flagged > 0 ? 'Start here' : 'Your squad'}
      </SectionTitle>
      {view.entries.map((e) => (
        <AthleteRow key={e.athlete.id} entry={e} />
      ))}

      {view.stale > 0 && (
        <Text style={styles.footnote}>
          {view.stale === 1
            ? '1 athlete has'
            : `${view.stale} athletes have`}{' '}
          not checked in recently. Their numbers are not shown because we cannot stand behind
          them.
        </Text>
      )}
    </ScrollView>
  );
}

function AthleteRow({ entry }: { entry: RosterEntry }) {
  const usable = entry.status !== 'stale';
  return (
    <Card>
      <View style={styles.rowTop}>
        <Text style={styles.name}>{entry.athlete.name}</Text>
        <View style={styles.rowRight}>
          <Text style={[styles.score, { color: STATUS_COLOR[entry.status] }]}>
            {usable ? entry.readiness.score : '--'}
          </Text>
          <Text style={[styles.status, { color: STATUS_COLOR[entry.status] }]}>
            {STATUS_LABEL[entry.status]}
          </Text>
        </View>
      </View>

      {entry.reason && <Text style={styles.reason}>{entry.reason}</Text>}

      {usable && entry.readinessAgeDays > 0 && (
        <Text style={styles.asOf}>
          As of {entry.readinessAgeDays === 1 ? 'yesterday' : `${entry.readinessAgeDays} days ago`} —
          not checked in today.
        </Text>
      )}

      {entry.recentOverrides > 0 && entry.meanOverrideCost !== undefined && (
        <Text style={styles.asOf}>
          {entry.recentOverrides} override{entry.recentOverrides === 1 ? '' : 's'} recently, costing{' '}
          {entry.meanOverrideCost} points on average.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: TAB_BAR_CLEARANCE },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowRight: { alignItems: 'flex-end' },
  name: { ...type.bodyStrong, fontSize: 17, color: colors.text, flex: 1 },
  score: { ...type.heading, fontSize: 24, fontWeight: '800' },
  status: { ...type.label, fontSize: 10 },
  reason: { ...type.caption, fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },
  asOf: { ...type.caption, fontSize: 12, color: colors.textTertiary, marginTop: spacing.xs },
  headline: { ...type.title, color: colors.text, marginBottom: spacing.sm },
  explain: { ...type.body, color: colors.textSecondary, lineHeight: 23 },
  explainTitle: { ...type.heading, color: colors.text, marginBottom: spacing.sm },
  footnote: { ...type.caption, fontSize: 12, color: colors.textTertiary, marginTop: spacing.lg, lineHeight: 18 },
  dim: { ...type.body, color: colors.textTertiary },
});
