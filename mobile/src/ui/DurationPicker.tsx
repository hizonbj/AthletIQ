/**
 * Session duration.
 *
 * Presets rather than a keyboard: almost every session is one of these, and
 * the exact minute does not change the training load enough to be worth a
 * keyboard. The stepper covers everything else.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from './theme';
import { tapFeedback } from './haptics';

const PRESETS = [30, 45, 60, 90, 120];
const STEP = 5;
const MIN = 5;
const MAX = 480;

export function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  const set = (minutes: number) => {
    tapFeedback();
    onChange(Math.min(MAX, Math.max(MIN, minutes)));
  };

  return (
    <View>
      <View style={styles.readout}>
        <Stepper label="−" onPress={() => set(value - STEP)} disabled={value <= MIN} />
        <View style={styles.valueWrap}>
          <Text style={styles.value}>{formatDuration(value)}</Text>
        </View>
        <Stepper label="+" onPress={() => set(value + STEP)} disabled={value >= MAX} />
      </View>

      <View style={styles.presets}>
        {PRESETS.map((p) => (
          <Pressable
            key={p}
            accessibilityRole="button"
            accessibilityLabel={`${p} minutes`}
            onPress={() => set(p)}
            style={[styles.preset, value === p && styles.presetSelected]}
          >
            <Text style={[styles.presetLabel, value === p && styles.presetLabelSelected]}>
              {p}m
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function Stepper({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase duration' : 'Decrease duration'}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={[styles.stepper, disabled && styles.stepperDisabled]}
    >
      <Text style={styles.stepperLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  valueWrap: { flex: 1, alignItems: 'center' },
  value: { ...type.title, color: colors.text },
  stepper: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDisabled: { opacity: 0.35 },
  stepperLabel: { color: colors.text, fontSize: 24, fontWeight: '600' },
  presets: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  preset: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
  },
  presetSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  presetLabel: { ...type.caption, color: colors.textTertiary, fontWeight: '600' },
  presetLabelSelected: { color: colors.text },
});
