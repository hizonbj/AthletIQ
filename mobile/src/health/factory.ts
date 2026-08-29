/** Picks the health backend for the current platform. */
import { Platform } from 'react-native';
import { NoopHealthProvider, type HealthProvider } from './types';
import { HealthKitProvider } from './healthKit';
import { HealthConnectProvider } from './healthConnect';

export function createHealthProvider(): HealthProvider {
  if (Platform.OS === 'ios') return new HealthKitProvider();
  if (Platform.OS === 'android') return new HealthConnectProvider();
  return new NoopHealthProvider();
}
