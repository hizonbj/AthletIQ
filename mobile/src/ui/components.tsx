/** Shared presentational pieces. No domain logic lives here. */
import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { bandColors, colors, radius, spacing } from './theme';
import type { Band } from '@/domain/types';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        (pressed || disabled) && styles.buttonMuted,
      ]}
    >
      <Text style={[styles.buttonLabel, variant === 'secondary' && styles.buttonLabelSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The readiness ring. Deliberately the only large number on the Today screen —
 * everything else on that screen explains this one figure.
 */
export function ReadinessRing({
  score,
  band,
  size = 200,
  /** False when there is no data behind the score: show a dash, not a number. */
  hasData = true,
}: {
  score: number;
  band: Band;
  size?: number;
  hasData?: boolean;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = hasData ? circumference * (Math.max(0, Math.min(100, score)) / 100) : 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={bandColors[band]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={styles.ringScore}>{hasData ? score : '--'}</Text>
        <Text style={styles.ringUnit}>readiness</Text>
      </View>
    </View>
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
    <Card style={styles.locked}>
      <Text style={styles.lockedTitle}>Locked</Text>
      <Text style={styles.lockedReason}>{reason}</Text>
      <Button label="See AthletIQ Pro" onPress={onUpgrade} variant="secondary" />
    </Card>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  buttonMuted: { opacity: 0.6 },
  buttonLabel: { color: '#04121F', fontSize: 15, fontWeight: '700' },
  buttonLabelSecondary: { color: colors.accent },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringScore: { color: colors.text, fontSize: 56, fontWeight: '800' },
  ringUnit: {
    color: colors.textDim,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  locked: { alignItems: 'flex-start', gap: spacing.sm },
  lockedTitle: { color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  lockedReason: { color: colors.text, fontSize: 15, lineHeight: 21, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipSelected: { borderColor: colors.accent, backgroundColor: '#12304C' },
  chipLabel: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  chipLabelSelected: { color: colors.text },
});
