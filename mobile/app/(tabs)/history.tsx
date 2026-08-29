/**
 * Logged sessions.
 *
 * Until now a session could be logged and never seen again, so a mistake — the
 * wrong intensity, a duplicate tap, a session that never happened — silently
 * inflated training load and skewed every readiness score after it, with no way
 * to correct it. Being able to see and delete what you logged is the floor.
 */
import React from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useApp } from '@/ui/AppState';
import { Card, SectionTitle } from '@/ui/components';
import { SwipeToDelete } from '@/ui/SwipeToDelete';
import { bandColors, colors, spacing, TAB_BAR_CLEARANCE, type } from '@/ui/theme';
import { sessionLoad } from '@/domain/load';
import { formatDuration } from '@/ui/DurationPicker';
import type { Intensity, Session } from '@/domain/types';

const INTENSITY_COLOR: Record<Intensity, string> = {
  rest: colors.textTertiary,
  easy: bandColors.go,
  moderate: bandColors.moderate,
  hard: bandColors.easy,
  max: bandColors.rest,
};

export default function HistoryScreen() {
  const { repo, deleteSession } = useApp();
  const [sessions, setSessions] = React.useState<Session[]>();

  const load = React.useCallback(() => {
    void repo.getSessions().then((s) => setSessions([...s].reverse()));
  }, [repo]);

  useFocusEffect(React.useCallback(() => load(), [load]));

  // The list holds its own copy, so deleting has to reload it — deleteSession
  // refreshes the derived insights but knows nothing about this screen's state.
  const remove = React.useCallback(
    async (id: string) => {
      await deleteSession(id);
      load();
    },
    [deleteSession, load],
  );

  if (!sessions) {
    return (
      <View style={styles.centered}>
        <Text style={styles.dim}>Loading…</Text>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.container}>
        <Card>
          <Text style={styles.emptyTitle}>Nothing logged yet.</Text>
          <Text style={styles.empty}>
            Sessions you log appear here, newest first. Swipe one away if you logged it by
            mistake.
          </Text>
        </Card>
      </View>
    );
  }

  // Grouped by month so a long history stays navigable.
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = s.date.slice(0, 7);
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }
  const data = [...groups.entries()].map(([month, items]) => ({ title: month, data: items }));

  return (
    <SectionList
      sections={data}
      keyExtractor={(item, index) => item.id ?? `${item.date}-${index}`}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => <SectionTitle>{monthLabel(section.title)}</SectionTitle>}
      renderItem={({ item }) => (
        <SwipeToDelete
          // A session with no id predates identity in storage and cannot be
          // addressed, so it is shown but not swipeable rather than pretending.
          onDelete={item.id ? () => void remove(item.id as string) : undefined}
          accessibilityLabel={`Delete ${item.intensity} session on ${item.date}`}
        >
          <SessionRow session={item} />
        </SwipeToDelete>
      )}
    />
  );
}

function SessionRow({ session }: { session: Session }) {
  return (
    <Card style={styles.row}>
      <View style={[styles.stripe, { backgroundColor: INTENSITY_COLOR[session.intensity] }]} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.intensity}>{session.intensity}</Text>
          <Text style={styles.date}>{dayLabel(session.date)}</Text>
        </View>
        <Text style={styles.meta}>
          {formatDuration(session.durationMin)} · load {Math.round(sessionLoad(session))}
        </Text>
      </View>
    </Card>
  );
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

function dayLabel(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${MONTHS[Number(month) - 1].slice(0, 3)} ${Number(day)}`;
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: TAB_BAR_CLEARANCE },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  stripe: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  intensity: { ...type.bodyStrong, color: colors.text, textTransform: 'capitalize' },
  date: { ...type.caption, color: colors.textTertiary },
  meta: { ...type.caption, color: colors.textSecondary, marginTop: 2 },
  emptyTitle: { ...type.heading, color: colors.text, marginBottom: spacing.sm },
  empty: { ...type.body, color: colors.textSecondary, lineHeight: 23 },
  dim: { ...type.body, color: colors.textTertiary },
});
