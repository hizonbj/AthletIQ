/**
 * Web-backed repository, for `expo start --web` and browser previews.
 *
 * expo-sqlite is a native module, so the web target needs its own store. This
 * keeps localStorage behind the same interface, and degrades to memory-only
 * when storage is unavailable (private windows, blocked site data).
 */
import type { CheckIn, DayISO, Session } from '@/domain/types';
import type { Repository } from './repository';

const KEY = 'athletiq.data.v1';

interface Snapshot {
  checkIns: CheckIn[];
  sessions: Session[];
}

function readStore(): Snapshot {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) return JSON.parse(raw) as Snapshot;
  } catch {
    // Storage unavailable or corrupt — start clean rather than crash the app.
  }
  return { checkIns: [], sessions: [] };
}

function writeStore(snap: Snapshot): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(snap));
  } catch {
    // Best effort: an unwritable store must not break logging.
  }
}

export class WebRepository implements Repository {
  private snap: Snapshot = readStore();

  private persist() {
    writeStore(this.snap);
  }

  async getCheckIns(): Promise<CheckIn[]> {
    return [...this.snap.checkIns].sort((a, b) => a.date.localeCompare(b.date));
  }

  async getCheckIn(date: DayISO): Promise<CheckIn | undefined> {
    return this.snap.checkIns.find((c) => c.date === date);
  }

  async putCheckIn(c: CheckIn): Promise<void> {
    this.snap.checkIns = [...this.snap.checkIns.filter((x) => x.date !== c.date), c];
    this.persist();
  }

  async getSessions(): Promise<Session[]> {
    return [...this.snap.sessions].sort((a, b) => a.date.localeCompare(b.date));
  }

  async addSession(s: Session): Promise<void> {
    this.snap.sessions = [...this.snap.sessions, s];
    this.persist();
  }

  async clear(): Promise<void> {
    this.snap = { checkIns: [], sessions: [] };
    this.persist();
  }
}
