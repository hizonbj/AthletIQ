/**
 * One athlete, from the coach's side.
 *
 * A coach is often the one holding the information — the athlete says they slept
 * badly on the way into the gym. So this screen records a check-in on their
 * behalf, using the same scales the athlete would see, so the numbers mean the
 * same thing whoever entered them.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useApp } from '@/ui/AppState';
import { Button, Card, SectionTitle } from '@/ui/components';
import { SemanticScale } from '@/ui/SemanticScale';
import { SleepPicker } from '@/ui/SleepPicker';
import {
  colorForDownScale,
  colorForUpScale,
  ENERGY_WORDS,
  SLEEP_QUALITY_WORDS,
  SORENESS_WORDS,
} from '@/ui/checkInCopy';
import { bandColors, bandCopy, colors, spacing, type } from '@/ui/theme';
import { buildRosterEntry, type AthleteData, type RosterEntry } from '@/domain/roster';
import { successFeedback } from '@/ui/haptics';
import type { CheckIn } from '@/domain/types';

const DEFAULT_SLEEP_HOURS = 7.5;

export default function AthleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rosterRepo, today } = useApp();
  const navigation = useNavigation();
  const router = useRouter();

  const [data, setData] = useState<AthleteData>();
  const [entry, setEntry] = useState<RosterEntry>();
  const [draft, setDraft] = useState<CheckIn>({ date: today, sleepHours: DEFAULT_SLEEP_HOURS });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = React.useCallback(async () => {
    const squad = await rosterRepo.getSquad();
    const found = squad.find((a) => a.athlete.id === id);
    if (!found) return;
    setData(found);
    setEntry(buildRosterEntry(found, today));
    const existing = found.checkIns.find((c) => c.date === today);
    if (existing) setDraft({ ...existing, sleepHours: existing.sleepHours ?? DEFAULT_SLEEP_HOURS });
  }, [rosterRepo, id, today]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (data) navigation.setOptions({ title: data.athlete.name });
  }, [data, navigation]);

  if (!data || !entry) {
    return (
      <View style={styles.centered}>
        <Text style={styles.dim}>Loading…</Text>
      </View>
    );
  }

  const usable = entry.status !== 'stale';
  const copy = bandCopy[entry.readiness.band];

  async function save() {
    setSaving(true);
    await rosterRepo.putCheckIn(id, draft);
    await load();
    successFeedback();
    setSaved(true);
    setSaving(false);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Card>
        <View style={styles.headline}>
          <View style={styles.headlineText}>
            <Text style={[styles.band, { color: bandColors[entry.readiness.band] }]}>
              {usable ? copy.title : 'No reading'}
            </Text>
            <Text style={styles.detail}>{entry.reason ?? copy.detail}</Text>
          </View>
          <Text style={[styles.score, { color: bandColors[entry.readiness.band] }]}>
            {usable ? entry.readiness.score : '--'}
          </Text>
        </View>
        {usable && entry.readinessAgeDays > 0 && (
          <Text style={styles.asOf}>
            Measured {entry.readinessAgeDays === 1 ? 'yesterday' : `${entry.readinessAgeDays} days ago`}.
          </Text>
        )}
        {entry.recentOverrides > 0 && (
          <Text style={styles.asOf}>
            {entry.recentOverrides} override{entry.recentOverrides === 1 ? '' : 's'} in the last 30
            days
            {entry.meanOverrideCost !== undefined
              ? `, costing ${entry.meanOverrideCost} points on average.`
              : '.'}
          </Text>
        )}
      </Card>

      <SectionTitle>Record today's check-in</SectionTitle>
      <Card>
        <SleepPicker
          value={draft.sleepHours}
          onChange={(sleepHours) => {
            setSaved(false);
            setDraft((d) => ({ ...d, sleepHours }));
          }}
        />
      </Card>

      <ScaleCard
        label="Sleep quality"
        words={SLEEP_QUALITY_WORDS}
        colorFor={colorForUpScale}
        value={draft.sleepQuality}
        onChange={(v) => {
          setSaved(false);
          setDraft((d) => ({ ...d, sleepQuality: v }));
        }}
      />
      <ScaleCard
        label="Soreness"
        words={SORENESS_WORDS}
        colorFor={colorForDownScale}
        value={draft.soreness}
        onChange={(v) => {
          setSaved(false);
          setDraft((d) => ({ ...d, soreness: v }));
        }}
      />
      <ScaleCard
        label="Energy"
        words={ENERGY_WORDS}
        colorFor={colorForUpScale}
        value={draft.energy}
        onChange={(v) => {
          setSaved(false);
          setDraft((d) => ({ ...d, energy: v }));
        }}
      />

      <Button
        label={saving ? 'Saving…' : saved ? 'Saved' : 'Save check-in'}
        onPress={() => void save()}
        disabled={saving}
        tint={saved ? bandColors.go : undefined}
      />
      <View style={styles.gap} />
      <Button label="Back to squad" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}

function ScaleCard({
  label,
  words,
  colorFor,
  value,
  onChange,
}: {
  label: string;
  words: readonly [string, string, string, string, string];
  colorFor: (v: number) => string;
  value?: number;
  onChange: (v: number) => void;
}) {
  return (
    <>
      <SectionTitle>{label}</SectionTitle>
      <SemanticScale
        label={label}
        words={words}
        colorFor={colorFor}
        value={value}
        onChange={onChange}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  headline: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  headlineText: { flex: 1 },
  band: { ...type.heading },
  score: { ...type.title, fontSize: 40 },
  detail: { ...type.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 19 },
  asOf: { ...type.caption, color: colors.textTertiary, marginTop: spacing.md },
  dim: { ...type.body, color: colors.textTertiary },
  gap: { height: spacing.sm },
});
