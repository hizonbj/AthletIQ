/**
 * Android Health Connect adapter.
 *
 * Requires a development build with the Health Connect permissions declared in
 * the manifest. Unlike the pinned iOS library, Health Connect exposes both
 * sleep sessions and resting heart rate, so Android imports both.
 */
import {
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type { DayISO } from '@/domain/types';
import {
  dailyRestingHr,
  dailySleepHours,
  toSamples,
  type HrReading,
  type SleepPeriod,
} from './aggregate';
import type { HealthProvider, HealthSample } from './types';

export class HealthConnectProvider implements HealthProvider {
  private initialized = false;

  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized) return true;
    this.initialized = await initialize();
    return this.initialized;
  }

  async isAvailable(): Promise<boolean> {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
    return this.ensureInitialized();
  }

  async requestPermissions(): Promise<boolean> {
    if (!(await this.ensureInitialized())) return false;
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'RestingHeartRate' },
    ]);
    // Partial grants are possible; both are needed for a complete import.
    return granted.length === 2;
  }

  async read(from: DayISO, to: DayISO): Promise<HealthSample[]> {
    if (!(await this.ensureInitialized())) return [];

    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: `${from}T00:00:00.000Z`,
      // `to` is inclusive, so run the window to the end of that day.
      endTime: `${to}T23:59:59.999Z`,
    };

    const [sleep, hr] = await Promise.all([
      readRecords('SleepSession', { timeRangeFilter }),
      readRecords('RestingHeartRate', { timeRangeFilter }),
    ]);

    const periods: SleepPeriod[] = sleep.records.map((r) => ({
      start: r.startTime,
      end: r.endTime,
    }));
    const readings: HrReading[] = hr.records.map((r) => ({
      at: r.time,
      bpm: r.beatsPerMinute,
    }));

    return toSamples(dailySleepHours(periods), dailyRestingHr(readings));
  }
}
