/**
 * SQLite-backed repository (expo-sqlite).
 *
 * Data stays on the device. That is a deliberate product choice as much as a
 * technical one: an override log is a record of the athlete's own judgement,
 * and there is no reason it should live on our server before they ask it to.
 */
import type { CheckIn, DayISO, Intensity, Session } from '@/domain/types';
import type { Repository } from './repository';

const DB_NAME = 'athletiq.db';

interface CheckInRow {
  date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  soreness: number | null;
  energy: number | null;
  resting_hr: number | null;
}

interface SessionRow {
  date: string;
  intensity: string;
  duration_min: number;
  rpe: number | null;
  notes: string | null;
}

function toCheckIn(r: CheckInRow): CheckIn {
  return {
    date: r.date,
    sleepHours: r.sleep_hours ?? undefined,
    sleepQuality: r.sleep_quality ?? undefined,
    soreness: r.soreness ?? undefined,
    energy: r.energy ?? undefined,
    restingHr: r.resting_hr ?? undefined,
  };
}

function toSession(r: SessionRow): Session {
  return {
    date: r.date,
    intensity: r.intensity as Intensity,
    durationMin: r.duration_min,
    rpe: r.rpe ?? undefined,
    notes: r.notes ?? undefined,
  };
}

type Database = Awaited<ReturnType<typeof import('expo-sqlite').openDatabaseAsync>>;

export class SqliteRepository implements Repository {
  private db: Database | null = null;

  private async handle(): Promise<Database> {
    if (this.db) return this.db;
    // Imported lazily: expo-sqlite binds its native module on evaluation, which
    // throws on web where no such module exists.
    const SQLite = await import('expo-sqlite');
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS check_ins (
        date TEXT PRIMARY KEY NOT NULL,
        sleep_hours REAL,
        sleep_quality INTEGER,
        soreness INTEGER,
        energy INTEGER,
        resting_hr INTEGER
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        intensity TEXT NOT NULL,
        duration_min INTEGER NOT NULL,
        rpe INTEGER,
        notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
    `);
    this.db = db;
    return db;
  }

  async getCheckIns(): Promise<CheckIn[]> {
    const db = await this.handle();
    const rows = await db.getAllAsync<CheckInRow>('SELECT * FROM check_ins ORDER BY date');
    return rows.map(toCheckIn);
  }

  async getCheckIn(date: DayISO): Promise<CheckIn | undefined> {
    const db = await this.handle();
    const row = await db.getFirstAsync<CheckInRow>(
      'SELECT * FROM check_ins WHERE date = ?',
      date,
    );
    return row ? toCheckIn(row) : undefined;
  }

  async putCheckIn(c: CheckIn): Promise<void> {
    const db = await this.handle();
    await db.runAsync(
      `INSERT INTO check_ins (date, sleep_hours, sleep_quality, soreness, energy, resting_hr)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         sleep_hours = excluded.sleep_hours,
         sleep_quality = excluded.sleep_quality,
         soreness = excluded.soreness,
         energy = excluded.energy,
         resting_hr = excluded.resting_hr`,
      c.date,
      c.sleepHours ?? null,
      c.sleepQuality ?? null,
      c.soreness ?? null,
      c.energy ?? null,
      c.restingHr ?? null,
    );
  }

  async getSessions(): Promise<Session[]> {
    const db = await this.handle();
    const rows = await db.getAllAsync<SessionRow>('SELECT * FROM sessions ORDER BY date');
    return rows.map(toSession);
  }

  async addSession(s: Session): Promise<void> {
    const db = await this.handle();
    await db.runAsync(
      'INSERT INTO sessions (date, intensity, duration_min, rpe, notes) VALUES (?, ?, ?, ?, ?)',
      s.date,
      s.intensity,
      s.durationMin,
      s.rpe ?? null,
      s.notes ?? null,
    );
  }

  async clear(): Promise<void> {
    const db = await this.handle();
    await db.execAsync('DELETE FROM check_ins; DELETE FROM sessions;');
  }
}
