/**
 * Web-backed repository, for `expo start --web` and browser previews.
 *
 * expo-sqlite is a native module, so the web target needs its own store. This
 * keeps localStorage behind the same interface, and degrades to memory-only
 * when storage is unavailable (private windows, blocked site data).
 */
import type { CheckIn, DayISO, Session } from '@/domain/types';
import type { Athlete, AthleteData } from '@/domain/roster';
import type { Repository } from './repository';
import type { RosterRepository } from './rosterRepository';

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

const ROSTER_KEY = 'athletiq.roster.v1';

/** Roster equivalent of `WebRepository`, for web dev and browser previews. */
export class WebRosterRepository implements RosterRepository {
  private squad: AthleteData[] = readRoster();

  private persist() {
    try {
      globalThis.localStorage?.setItem(ROSTER_KEY, JSON.stringify(this.squad));
    } catch {
      // Best effort, as above.
    }
  }

  async getSquad(): Promise<AthleteData[]> {
    return this.squad;
  }

  async addAthlete(athlete: Athlete): Promise<void> {
    if (this.squad.some((d) => d.athlete.id === athlete.id)) return;
    this.squad.push({ athlete, checkIns: [], sessions: [] });
    this.persist();
  }

  async removeAthlete(athleteId: string): Promise<void> {
    this.squad = this.squad.filter((d) => d.athlete.id !== athleteId);
    this.persist();
  }

  async putCheckIn(athleteId: string, checkIn: CheckIn): Promise<void> {
    const data = this.require(athleteId);
    data.checkIns = [...data.checkIns.filter((c) => c.date !== checkIn.date), checkIn];
    this.persist();
  }

  async addSession(athleteId: string, session: Session): Promise<void> {
    this.require(athleteId).sessions.push(session);
    this.persist();
  }

  private require(athleteId: string): AthleteData {
    const data = this.squad.find((d) => d.athlete.id === athleteId);
    if (!data) throw new Error(`No such athlete: ${athleteId}`);
    return data;
  }
}

function readRoster(): AthleteData[] {
  try {
    const raw = globalThis.localStorage?.getItem(ROSTER_KEY);
    if (raw) return JSON.parse(raw) as AthleteData[];
  } catch {
    // Corrupt or unavailable storage — start with an empty squad.
  }
  return [];
}
