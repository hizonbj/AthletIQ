/**
 * The readiness trend.
 *
 * Bars rather than a line: days are discrete, gaps are common, and a line
 * across a missing day would draw a value that was never measured. Each bar
 * carries its band colour, so the shape of a bad week is visible without
 * reading an axis.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { bandColors, colors, spacing, type } from './theme';
import { bandForScore } from '@/domain/readiness';
import type { HistoryPoint } from '@/domain/insights';

const HEIGHT = 72;

export function Trend({ points }: { points: HistoryPoint[] }) {
  if (points.length === 0) {
    return <Text style={styles.empty}>Nothing logged yet.</Text>;
  }

  const average = Math.round(points.reduce((sum, p) => sum + p.score, 0) / points.length);

  return (
    <View>
      <View style={styles.chart}>
        {points.map((p, i) => (
          <Animated.View
            key={p.date}
            entering={FadeInDown.delay(i * 24).duration(300)}
            style={styles.column}
          >
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(5, (p.score / 100) * HEIGHT),
                  backgroundColor: bandColors[bandForScore(p.score)],
                },
              ]}
            />
          </Animated.View>
        ))}
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisLabel}>{shortDate(points[0].date)}</Text>
        <Text style={styles.average}>avg {average}</Text>
        <Text style={styles.axisLabel}>
          {points.length > 1 ? shortDate(points[points.length - 1].date) : ''}
        </Text>
      </View>
    </View>
  );
}

/** "Aug 29" from an ISO day, without pulling in a date library. */
function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[Number(month) - 1]} ${Number(day)}`;
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: HEIGHT },
  column: { flex: 1, justifyContent: 'flex-end', height: HEIGHT },
  bar: { borderRadius: 3, minWidth: 4 },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  axisLabel: { ...type.caption, color: colors.textTertiary, fontSize: 11 },
  average: { ...type.caption, color: colors.textSecondary, fontWeight: '600' },
  empty: { ...type.body, color: colors.textTertiary },
});
