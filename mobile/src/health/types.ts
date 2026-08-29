/**
 * Health import seam.
 *
 * Sleep and resting HR are the two signals people will not reliably type in
 * every morning, and they are exactly the two a phone already knows. Everything
 * platform-specific sits behind `HealthProvider`; the merge rules live in
 * `merge.ts`, which is pure and tested, because that is where the behaviour
 * that matters lives.
 */
import type { DayISO } from '@/domain/types';

/** One day's worth of what the platform health store knows. */
export interface HealthSample {
  date: DayISO;
  sleepHours?: number;
  restingHr?: number;
}

export interface HealthProvider {
  /** Whether this build can read health data at all. */
  isAvailable(): Promise<boolean>;
  /** Prompt for read access. Returns whether it was granted. */
  requestPermissions(): Promise<boolean>;
  /** Daily samples across the inclusive range, ascending. Missing days omitted. */
  read(from: DayISO, to: DayISO): Promise<HealthSample[]>;
}

/** Used on web and wherever health data is unavailable. */
export class NoopHealthProvider implements HealthProvider {
  async isAvailable(): Promise<boolean> {
    return false;
  }
  async requestPermissions(): Promise<boolean> {
    return false;
  }
  async read(): Promise<HealthSample[]> {
    return [];
  }
}
