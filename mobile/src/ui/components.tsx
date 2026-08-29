/**
 * Shared presentational pieces. No domain logic lives here.
 *
 * Everything pressable animates and gives haptic feedback on touch, because on
 * a phone the confirmation that a tap registered has to be physical — waiting
 * for the screen to redraw is what makes an app feel slow even when it is not.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, motion, radius, spacing, type } from './theme';
import { tapFeedback } from './haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Presses scale toward the finger. Shared by every tappable surface. */
function usePressScale(to = 0.96) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => {
      scale.value = withSpring(to, motion.springSnappy);
    },
    onPressOut: () => {
      scale.value = withSpring(1, motion.springSnappy);
    },
  };
}

export function Card({
  children,
  style,
  tone = 'default',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** `accent` draws a coloured edge, for the one card that matters on a screen. */
  tone?: 'default' | 'accent' | 'sunken';
}) {
  return (
    <View
      style={[
        styles.card,
        tone === 'accent' && styles.cardAccent,
        tone === 'sunken' && styles.cardSunken,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  tint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  /** Overrides the fill, so a CTA can carry the readiness band's colour. */
  tint?: string;
}) {
  const press = usePressScale();
  const filled = variant === 'primary';

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={disabled}
      style={[
        press.style,
        styles.button,
        filled && { backgroundColor: tint ?? colors.accent },
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'secondary' && tint ? { borderColor: tint } : null,
        variant === 'ghost' && styles.buttonGhost,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          filled && styles.buttonLabelFilled,
          !filled && { color: tint ?? colors.accent },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

/** A locked panel. Shows the shape of what is behind it, never fake data. */
export function LockedPanel({
  reason,
  onUpgrade,
}: {
  reason: string;
  onUpgrade: () => void;
}) {
  return (
    <Card tone="accent">
      <Text style={styles.lockedTag}>AthletIQ Pro</Text>
      <Text style={styles.lockedReason}>{reason}</Text>
      <Button label="See what you get" onPress={onUpgrade} />
    </Card>
  );
}

/** A single stat, for the summary strip at the top of a screen. */
export function Stat({
  value,
  label,
  color = colors.text,
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Horizontal rule used inside cards, between rows. */
export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardAccent: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  cardSunken: { backgroundColor: colors.surfaceSunken },
  sectionTitle: {
    ...type.label,
    color: colors.textTertiary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  buttonGhost: { backgroundColor: 'transparent', paddingVertical: 12 },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { ...type.bodyStrong },
  buttonLabelFilled: { color: '#03121F', fontWeight: '700' },
  lockedTag: { ...type.label, color: colors.accent, marginBottom: spacing.sm },
  lockedReason: {
    ...type.body,
    color: colors.text,
    lineHeight: 23,
    marginBottom: spacing.lg,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  statValue: { ...type.title },
  statLabel: { ...type.label, color: colors.textTertiary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
});
