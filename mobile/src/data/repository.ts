/**
 * Storage boundary.
 *
 * The domain never touches SQLite. `InMemoryRepository` backs the tests and
 * previews; `SqliteRepository` backs the app. Both satisfy this interface, so
 * the engine is verifiable without a device.
 */
import type { CheckIn, DayISO, Session } from '@/domain/types';

export interface Repository {
  getCheckIns(): Promise<CheckIn[]>;
  getCheckIn(date: DayISO): Promise<CheckIn | undefined>;
  /** Insert or replace the check-in for its date. */
  putCheckIn(checkIn: CheckIn): Promise<void>;

  getSessions(): Promise<Session[]>;
  addSession(session: Session): Promise<void>;

  clear(): Promise<void>;
}

export class InMemoryRepository implements Repository {
  private checkIns = new Map<DayISO, CheckIn>();
  private sessions: Session[] = [];

  constructor(seed?: { checkIns?: CheckIn[]; sessions?: Session[] }) {
    seed?.checkIns?.forEach((c) => this.checkIns.set(c.date, c));
    this.sessions = [...(seed?.sessions ?? [])];
  }

  async getCheckIns(): Promise<CheckIn[]> {
    return [...this.checkIns.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async getCheckIn(date: DayISO): Promise<CheckIn | undefined> {
    return this.checkIns.get(date);
  }

  async putCheckIn(checkIn: CheckIn): Promise<void> {
    this.checkIns.set(checkIn.date, checkIn);
  }

  async getSessions(): Promise<Session[]> {
    return [...this.sessions].sort((a, b) => a.date.localeCompare(b.date));
  }

  async addSession(session: Session): Promise<void> {
    this.sessions.push(session);
  }

  async clear(): Promise<void> {
    this.checkIns.clear();
    this.sessions = [];
  }
}
