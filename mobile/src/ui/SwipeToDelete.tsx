/**
 * Swipe a row left to reveal a delete action.
 *
 * Deleting is destructive and irreversible here, so it takes a deliberate
 * gesture followed by a tap — never a single tap that could be a mis-hit while
 * scrolling. Rows that cannot be deleted simply do not swipe.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { bandColors, colors, motion, radius, spacing, type } from './theme';
import { impactFeedback, warningFeedback } from './haptics';

const ACTION_WIDTH = 96;
/** Past this much drag the row settles open rather than springing back. */
const OPEN_THRESHOLD = ACTION_WIDTH / 2;

export function SwipeToDelete({
  children,
  onDelete,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  /** Undefined makes the row static — nothing to delete. */
  onDelete?: () => void;
  accessibilityLabel: string;
}) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const close = () => {
    translateX.value = withSpring(0, motion.springSnappy);
  };

  const pan = Gesture.Pan()
    // Let vertical scrolling win: the list must stay scrollable.
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      // Left only, and never further than the action it reveals.
      const next = Math.min(0, Math.max(-ACTION_WIDTH, startX.value + e.translationX));
      translateX.value = next;
    })
    .onEnd(() => {
      const shouldOpen = translateX.value < -OPEN_THRESHOLD;
      translateX.value = withSpring(shouldOpen ? -ACTION_WIDTH : 0, motion.springSnappy);
      if (shouldOpen) runOnJS(impactFeedback)();
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  if (!onDelete) return <>{children}</>;

  return (
    <View style={styles.wrap}>
      <View style={styles.actionLayer}>
        <Pressable
          onPress={() => {
            warningFeedback();
            close();
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={styles.action}
        >
          <Text style={styles.actionLabel}>Delete</Text>
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  actionLayer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: spacing.md,
    width: ACTION_WIDTH,
    justifyContent: 'center',
  },
  action: {
    flex: 1,
    backgroundColor: bandColors.rest,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...type.bodyStrong, color: colors.bg, fontWeight: '800' },
});
