/**
 * Backup and restore.
 *
 * The product's whole value is an accumulated record, and it lives only on the
 * device. Losing a phone would destroy exactly the thing someone has been
 * paying for, so the data has to be exportable — and importable somewhere else.
 *
 * The parser is deliberately strict but forgiving in one direction: unknown
 * fields are dropped rather than rejected, so a backup from a newer version
 * still restores what this version understands. Malformed records are skipped
 * and counted, not silently coerced into wrong values.
 */
import type { CheckIn, DayISO, Intensity, Session } from '@/domain/types';
import { INTENSITIES } from '@/domain/types';
import type { Repository } from './repository';

export const BACKUP_VERSION = 1;

export interface Backup {
  version: number;
  exportedAt: string;
  checkIns: CheckIn[];
  sessions: Session[];
}

export interface ParseResult {
  backup: Backup;
  /** Records dropped as malformed, surfaced rather than hidden. */
  skipped: number;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDay(v: unknown): v is DayISO {
  return typeof v === 'string' && DAY_PATTERN.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

/** A finite number within range, or undefined. Rejects NaN, strings and null. */
function optionalNumber(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return v >= min && v <= max ? v : undefined;
}

function parseCheckIn(raw: unknown): CheckIn | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (!isDay(r.date)) return undefined;
  return {
    date: r.date,
    sleepHours: optionalNumber(r.sleepHours, 0, 24),
    sleepQuality: optionalNumber(r.sleepQuality, 1, 5),
    soreness: optionalNumber(r.soreness, 1, 5),
    energy: optionalNumber(r.energy, 1, 5),
    restingHr: optionalNumber(r.restingHr, 20, 220),
  };
}

function parseSession(raw: unknown): Session | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (!isDay(r.date)) return undefined;
  if (typeof r.intensity !== 'string') return undefined;
  if (!INTENSITIES.includes(r.intensity as Intensity)) return undefined;
  const durationMin = optionalNumber(r.durationMin, 0, 24 * 60);
  if (durationMin === undefined) return undefined;
  return {
    date: r.date,
    intensity: r.intensity as Intensity,
    durationMin,
    rpe: optionalNumber(r.rpe, 0, 10),
    notes: typeof r.notes === 'string' ? r.notes : undefined,
  };
}

export async function exportBackup(repo: Repository): Promise<Backup> {
  const [checkIns, sessions] = await Promise.all([repo.getCheckIns(), repo.getSessions()]);
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    checkIns,
    sessions,
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

/** Parse a backup file. Throws only when the file is not a backup at all. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('That file is not an AthletIQ backup.');
  }

  const r = raw as Record<string, unknown>;
  if (typeof r.version !== 'number') {
    throw new Error('That file is not an AthletIQ backup.');
  }
  if (r.version > BACKUP_VERSION) {
    throw new Error(
      `That backup was made by a newer version of AthletIQ (v${r.version}). Update the app first.`,
    );
  }
  if (!Array.isArray(r.checkIns) || !Array.isArray(r.sessions)) {
    throw new Error('That backup is missing its records.');
  }

  let skipped = 0;
  const checkIns: CheckIn[] = [];
  for (const item of r.checkIns) {
    const parsed = parseCheckIn(item);
    if (parsed) checkIns.push(parsed);
    else skipped++;
  }

  const sessions: Session[] = [];
  for (const item of r.sessions) {
    const parsed = parseSession(item);
    if (parsed) sessions.push(parsed);
    else skipped++;
  }

  return {
    backup: {
      version: r.version,
      exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : new Date().toISOString(),
      checkIns,
      sessions,
    },
    skipped,
  };
}

export interface RestoreResult {
  checkInsRestored: number;
  sessionsRestored: number;
}

/**
 * Restore into a repository, replacing everything.
 *
 * Replace rather than merge: merging two histories would create duplicate
 * sessions, which silently inflates training load and corrupts every score
 * downstream. A restore is a deliberate act and should be predictable.
 */
export async function restoreBackup(repo: Repository, backup: Backup): Promise<RestoreResult> {
  await repo.clear();
  for (const checkIn of backup.checkIns) await repo.putCheckIn(checkIn);
  for (const session of backup.sessions) await repo.addSession(session);
  return {
    checkInsRestored: backup.checkIns.length,
    sessionsRestored: backup.sessions.length,
  };
}
