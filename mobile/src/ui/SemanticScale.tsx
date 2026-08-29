/**
 * A 1-5 subjective scale.
 *
 * Every option is spelled out. The first draft showed five unlabelled bars with
 * only the chosen word echoed above, which meant the athlete had to tap to find
 * out what they were choosing — unusable for the one interaction that happens
 * every single morning.
 *
 * Rows run worst to best, matching the underlying 1-5 value and the intensity
 * picker, and each carries a rank marker so the list still reads as a scale.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, motion, radius, spacing, type } from './theme';
import { tapFeedback } from './haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface SemanticScaleProps {
  label: string;
  /** Five words, worst to best in the order they are tapped. */
  words: readonly [string, string, string, string, string];
  /** Colour for a given 1-5 value. Usually the semantic colour of the answer. */
  colorFor: (value: number) => string;
  value?: number;
  onChange: (value: number) => void;
}

export function SemanticScale({ label, words, colorFor, value, onChange }: SemanticScaleProps) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label}>
      {words.map((word, i) => {
        const n = i + 1;
        return (
          <Option
            key={word}
            word={word}
            rank={n}
            color={colorFor(n)}
            selected={value === n}
            onPress={() => {
              tapFeedback();
              onChange(n);
            }}
          />
        );
      })}
    </View>
  );
}

function Option({
  word,
  rank,
  color,
  selected,
  onPress,
}: {
  word: string;
  rank: number;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={word}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98, motion.springSnappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.springSnappy);
      }}
      style={[
        animatedStyle,
        styles.option,
        selected && { borderColor: color, backgroundColor: colors.surfaceRaised },
      ]}
    >
      {/* Five pips, `rank` of them filled: the row's place on the scale is
          visible without reading the word. */}
      <View style={styles.pips}>
        {[1, 2, 3, 4, 5].map((p) => (
          <View
            key={p}
            style={[
              styles.pip,
              p <= rank && { backgroundColor: color },
              p <= rank && selected && styles.pipTall,
            ]}
          />
        ))}
      </View>

      <Text style={[styles.word, selected && { color: colors.text }]}>{word}</Text>

      <View style={[styles.check, selected && { borderColor: color, backgroundColor: color }]}>
        {selected && <Text style={styles.checkGlyph}>✓</Text>}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  pips: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 16 },
  pip: {
    width: 4,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.surfaceSunken,
  },
  pipTall: { height: 14 },
  word: { ...type.bodyStrong, fontSize: 17, color: colors.textSecondary, flex: 1 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: { color: colors.bg, fontSize: 13, fontWeight: '800' },
});
