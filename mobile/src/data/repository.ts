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
  /** Remove one stored session. A no-op if the id is unknown. */
  deleteSession(id: string): Promise<void>;

  clear(): Promise<void>;
}

export class InMemoryRepository implements Repository {
  private checkIns = new Map<DayISO, CheckIn>();
  private sessions: Session[] = [];
  private nextId = 0;

  constructor(seed?: { checkIns?: CheckIn[]; sessions?: Session[] }) {
    seed?.checkIns?.forEach((c) => this.checkIns.set(c.date, c));
    this.sessions = (seed?.sessions ?? []).map((s) => ({
      ...s,
      id: s.id ?? `mem-${++this.nextId}`,
    }));
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
    this.sessions.push({ ...session, id: session.id ?? `mem-${++this.nextId}` });
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== id);
  }

  async clear(): Promise<void> {
    this.checkIns.clear();
    this.sessions = [];
  }
}
