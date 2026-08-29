/**
 * The import action the UI calls.
 *
 * Pure orchestration over the provider and the merge rules, so it can be tested
 * against a fake provider without a device.
 */
import type { DayISO } from '@/domain/types';
import type { Repository } from '@/data/repository';
import { addDays } from '@/domain/dates';
import { mergeHealthData } from './merge';
import type { HealthProvider } from './types';

/** How far back an import reaches on first run. */
export const IMPORT_WINDOW_DAYS = 30;

export type ImportStatus = 'imported' | 'nothing-new' | 'denied' | 'unavailable';

export interface ImportResult {
  status: ImportStatus;
  /** Individual values written. Zero for every status except `imported`. */
  filledCount: number;
}

export async function importHealthData(
  provider: HealthProvider,
  repo: Repository,
  today: DayISO,
  windowDays = IMPORT_WINDOW_DAYS,
): Promise<ImportResult> {
  if (!(await provider.isAvailable())) {
    return { status: 'unavailable', filledCount: 0 };
  }
  if (!(await provider.requestPermissions())) {
    return { status: 'denied', filledCount: 0 };
  }

  const samples = await provider.read(addDays(today, -(windowDays - 1)), today);
  const { updated, filledCount } = mergeHealthData(await repo.getCheckIns(), samples);

  for (const checkIn of updated) {
    await repo.putCheckIn(checkIn);
  }

  return {
    status: filledCount > 0 ? 'imported' : 'nothing-new',
    filledCount,
  };
}
