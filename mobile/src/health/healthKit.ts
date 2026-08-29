/**
 * iOS HealthKit adapter.
 *
 * Requires a development build (`npx expo prebuild`) with HealthKit enabled and
 * the usage strings in Info.plist. It cannot run in Expo Go or on web.
 *
 * KNOWN GAP: sleep is a HealthKit *category* sample, and the version of
 * @kingstinct/react-native-healthkit pinned here (10.x, the newest that
 * supports React 18) exposes no category query. So iOS imports resting HR only;
 * sleep is still typed in. Lifting this means React 19, which means a newer
 * Expo SDK — a deliberate deferral, not an oversight. The seam means only this
 * file changes when that happens.
 */
import {
  isHealthDataAvailableAsync,
  queryQuantitySamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type { DayISO } from '@/domain/types';
import { dailyRestingHr, toSamples, type HrReading } from './aggregate';
import type { HealthProvider, HealthSample } from './types';

const RESTING_HR = 'HKQuantityTypeIdentifierRestingHeartRate' as const;

export class HealthKitProvider implements HealthProvider {
  async isAvailable(): Promise<boolean> {
    return isHealthDataAvailableAsync();
  }

  async requestPermissions(): Promise<boolean> {
    return requestAuthorization([], [RESTING_HR]);
  }

  async read(from: DayISO, to: DayISO): Promise<HealthSample[]> {
    const samples = await queryQuantitySamples(RESTING_HR, {
      filter: {
        startDate: new Date(`${from}T00:00:00.000Z`),
        // `to` is inclusive, so run the window to the end of that day.
        endDate: new Date(`${to}T23:59:59.999Z`),
      },
      unit: 'count/min',
    });

    const readings: HrReading[] = samples.map((s) => ({
      at: new Date(s.startDate).toISOString(),
      bpm: s.quantity,
    }));

    return toSamples(new Map(), dailyRestingHr(readings));
  }
}
