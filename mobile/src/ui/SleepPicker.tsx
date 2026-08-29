/**
 * Sleep duration, without a keyboard.
 *
 * Typing "7.5" into a numeric field at 6am is the single worst interaction in
 * the old build: it demands precision nobody has about their own sleep and
 * raises a keyboard over the screen to get it. A scrubbing ruler is faster,
 * needs one thumb, and communicates the plausible range by existing.
 *
 * Ticks are 15 minutes apart, which is finer than anyone's recall and coarse
 * enough to reach any value in a short swipe.
 */
import React, { useCallback, useMemo, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { colors, spacing, type } from './theme';
import {
  formatHours,
  offsetForValue,
  TICK_SPACING,
  TICKS,
  valueForOffset,
} from './sleepScale';
import { tapFeedback } from './haptics';

export function SleepPicker({
  value,
  onChange,
}: {
  value?: number;
  onChange: (hours: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = React.useState(0);
  const lastReported = useRef<number | undefined>(value);

  // Half the viewport of padding at each end lets the first and last ticks
  // reach the centre line.
  const sidePad = width / 2;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  // Align the ruler to the incoming value once the width is known, and again if
  // a prefilled value arrives after mount. Guarded on `lastReported` so this
  // never fights the user's own scrolling.
  React.useEffect(() => {
    if (width === 0 || value === undefined) return;
    if (lastReported.current === value) return;
    lastReported.current = value;
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ x: offsetForValue(value), animated: false }),
    );
  }, [value, width]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = valueForOffset(e.nativeEvent.contentOffset.x);
      if (next !== lastReported.current) {
        lastReported.current = next;
        // One tick of feedback per value crossed: the control feels detented.
        tapFeedback();
        onChange(next);
      }
    },
    [onChange],
  );

  const ticks = useMemo(
    () =>
      TICKS.map((t) => {
        const isHour = Number.isInteger(t);
        const isHalf = !isHour && Math.abs(t % 1) === 0.5;
        return (
          <View key={t} style={styles.tickSlot}>
            <View
              style={[
                styles.tick,
                isHour && styles.tickHour,
                isHalf && styles.tickHalf,
              ]}
            />
            {isHour && <Text style={styles.tickLabel}>{t}</Text>}
          </View>
        );
      }),
    [],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.value}>{value === undefined ? '--' : formatHours(value)}</Text>
      <Text style={styles.caption}>hours slept</Text>

      <View style={styles.rulerWrap} onLayout={onLayout}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={TICK_SPACING}
          decelerationRate="fast"
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: sidePad }}
          accessibilityLabel="Hours slept"
        >
          <View style={styles.ticks}>{ticks}</View>
        </ScrollView>

        {/* The centre line is the read head: whatever sits under it is the value. */}
        <View style={styles.indicator} pointerEvents="none" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: spacing.lg },
  value: { ...type.title, fontSize: 40, color: colors.text },
  caption: { ...type.label, color: colors.textTertiary, marginTop: -2 },
  rulerWrap: { height: 64, width: '100%', marginTop: spacing.lg, justifyContent: 'center' },
  ticks: { flexDirection: 'row', alignItems: 'flex-end', height: 56 },
  tickSlot: { width: TICK_SPACING, alignItems: 'center', justifyContent: 'flex-end', height: 56 },
  tick: { width: 2, height: 12, borderRadius: 1, backgroundColor: colors.borderStrong },
  tickHalf: { height: 18 },
  tickHour: { height: 28, backgroundColor: colors.textTertiary },
  tickLabel: { ...type.caption, color: colors.textTertiary, marginTop: 4, fontSize: 11 },
  indicator: {
    position: 'absolute',
    alignSelf: 'center',
    width: 3,
    height: 40,
    borderRadius: 2,
    backgroundColor: colors.accent,
    bottom: 12,
  },
});
