/**
 * The readiness ring.
 *
 * The only large element on the Today screen, and the only saturated colour, so
 * the answer registers before any text is read. The arc sweeps and the number
 * counts up on mount — a score that simply appears reads as a static label,
 * while one that arrives reads as a measurement that was just taken.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { bandColors, bandColorsDim, colors, motion, type } from './theme';
import type { Band } from '@/domain/types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ReadinessRing({
  score,
  band,
  size = 240,
  hasData = true,
}: {
  score: number;
  band: Band;
  size?: number;
  /** False when nothing has been logged: show a dash, never an invented number. */
  hasData?: boolean;
}) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const progress = useSharedValue(0);
  const [display, setDisplay] = React.useState(0);

  useEffect(() => {
    progress.value = withTiming(hasData ? score / 100 : 0, {
      duration: motion.duration.count,
      // Decelerating: fast to establish the answer, slow to settle on it.
      easing: Easing.out(Easing.cubic),
    });
  }, [score, hasData, progress]);

  // Mirror the animated value into React state so the numeral counts with the
  // arc. Rounded first, so this fires ~100 times rather than every frame.
  const rounded = useDerivedValue(() => Math.round(progress.value * 100));
  useAnimatedReaction(
    () => rounded.value,
    (current, previous) => {
      if (current !== previous) runOnJS(setDisplay)(current);
    },
  );

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringFill" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={bandColors[band]} stopOpacity="1" />
            <Stop offset="1" stopColor={bandColors[band]} stopOpacity="0.55" />
          </LinearGradient>
        </Defs>

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={hasData ? bandColorsDim[band] : colors.surfaceRaised}
          strokeWidth={stroke}
          fill="none"
        />
        {hasData && (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#ringFill)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            fill="none"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>

      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.score, !hasData && styles.scoreEmpty]}>
          {hasData ? display : '--'}
        </Text>
        <Text style={styles.unit}>readiness</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  score: { ...type.display, color: colors.text },
  scoreEmpty: { color: colors.textTertiary },
  unit: { ...type.label, color: colors.textTertiary, marginTop: -4 },
});
