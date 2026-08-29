/**
 * Haptic feedback.
 *
 * Wrapped rather than called directly so the rest of the UI never has to think
 * about platforms where haptics do not exist, and so the vocabulary stays
 * small: selection for every tap that changes a value, success for completing
 * the check-in, warning for acknowledging an override.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export function tapFeedback(): void {
  if (enabled) void Haptics.selectionAsync();
}

export function successFeedback(): void {
  if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function warningFeedback(): void {
  if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export function impactFeedback(): void {
  if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
