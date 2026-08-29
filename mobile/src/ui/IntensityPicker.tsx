/**
 * Intensity selection.
 *
 * Each level is a full-width row with a plain description, because "moderate"
 * means different things to different athletes and the app depends on the
 * answer being comparable over months. A divider marks where today's
 * recommendation stops, so crossing it is a visible act.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { bandColors, colors, motion, radius, spacing, type } from './theme';
import { tapFeedback } from './haptics';
import { INTENSITIES, intensityRank, type Intensity } from '@/domain/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DESCRIPTIONS: Record<Intensity, string> = {
  rest: 'Nothing, or a walk',
  easy: 'Conversational the whole way',
  moderate: 'Working, but could hold it',
  hard: 'Breathing hard, counting down',
  max: 'Race pace or a true limit',
};

export function IntensityPicker({
  value,
  ceiling,
  bandColor,
  onChange,
}: {
  value?: Intensity;
  /** The hardest intensity today's readiness endorses. */
  ceiling?: Intensity;
  bandColor: string;
  onChange: (i: Intensity) => void;
}) {
  const ceilingRank = ceiling ? intensityRank(ceiling) : undefined;

  return (
    <View>
      {INTENSITIES.map((intensity, i) => {
        const above = ceilingRank !== undefined && i > ceilingRank;
        const isFirstAbove = ceilingRank !== undefined && i === ceilingRank + 1;

        return (
          <React.Fragment key={intensity}>
            {isFirstAbove && (
              <View style={styles.boundary}>
                <View style={styles.boundaryLine} />
                <Text style={styles.boundaryLabel}>today's limit</Text>
                <View style={styles.boundaryLine} />
              </View>
            )}
            <Row
              intensity={intensity}
              selected={value === intensity}
              // Above the limit the row adopts the warning colour it will trigger,
              // so the choice and its consequence read as the same thing.
              tint={above ? bandColors.easy : bandColor}
              onPress={() => {
                tapFeedback();
                onChange(intensity);
              }}
            />
          </React.Fragment>
        );
      })}
    </View>
  );
}

function Row({
  intensity,
  selected,
  tint,
  onPress,
}: {
  intensity: Intensity;
  selected: boolean;
  tint?: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const accent = tint ?? colors.textSecondary;

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${intensity}: ${DESCRIPTIONS[intensity]}`}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98, motion.springSnappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.springSnappy);
      }}
      style={[
        animatedStyle,
        styles.row,
        selected && { borderColor: accent, backgroundColor: colors.surfaceRaised },
      ]}
    >
      <View style={[styles.dot, selected && { backgroundColor: accent, borderColor: accent }]} />
      <View style={styles.rowText}>
        <Text style={[styles.name, selected && { color: colors.text }]}>{intensity}</Text>
        <Text style={styles.description}>{DESCRIPTIONS[intensity]}</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  rowText: { flex: 1 },
  name: { ...type.bodyStrong, color: colors.textSecondary, textTransform: 'capitalize' },
  description: { ...type.caption, color: colors.textTertiary, marginTop: 1 },
  boundary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  boundaryLine: { flex: 1, height: 1, backgroundColor: colors.border },
  boundaryLabel: { ...type.label, color: colors.textTertiary, fontSize: 10 },
});
