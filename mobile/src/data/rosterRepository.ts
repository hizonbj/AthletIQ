/**
 * Roster storage.
 *
 * A coach's squad is a set of athletes, each with their own check-ins and
 * sessions. This wraps that in the same shape the single-athlete repository
 * uses, so `buildRoster` can stay a pure function over plain data.
 */
import type { AthleteData, Athlete } from '@/domain/roster';
import type { CheckIn, Session } from '@/domain/types';

export interface RosterRepository {
  getSquad(): Promise<AthleteData[]>;
  addAthlete(athlete: Athlete): Promise<void>;
  removeAthlete(athleteId: string): Promise<void>;
  putCheckIn(athleteId: string, checkIn: CheckIn): Promise<void>;
  addSession(athleteId: string, session: Session): Promise<void>;
}

export class InMemoryRosterRepository implements RosterRepository {
  private squad = new Map<string, AthleteData>();

  constructor(seed: AthleteData[] = []) {
    seed.forEach((d) => this.squad.set(d.athlete.id, d));
  }

  async getSquad(): Promise<AthleteData[]> {
    return [...this.squad.values()];
  }

  async addAthlete(athlete: Athlete): Promise<void> {
    if (this.squad.has(athlete.id)) return;
    this.squad.set(athlete.id, { athlete, checkIns: [], sessions: [] });
  }

  async removeAthlete(athleteId: string): Promise<void> {
    this.squad.delete(athleteId);
  }

  async putCheckIn(athleteId: string, checkIn: CheckIn): Promise<void> {
    const data = this.require(athleteId);
    data.checkIns = [...data.checkIns.filter((c) => c.date !== checkIn.date), checkIn];
  }

  async addSession(athleteId: string, session: Session): Promise<void> {
    this.require(athleteId).sessions.push(session);
  }

  private require(athleteId: string): AthleteData {
    const data = this.squad.get(athleteId);
    if (!data) throw new Error(`No such athlete: ${athleteId}`);
    return data;
  }
}
