import { describe, expect, it } from 'vitest';
import {
  buildRoster,
  buildRosterEntry,
  OVERRIDE_WINDOW_DAYS,
  STALE_AFTER_DAYS,
  type AthleteData,
} from '@/domain/roster';
import { addDays } from '@/domain/dates';
import type { CheckIn, Session } from '@/domain/types';

const TODAY = '2026-08-29';

const good = (date: string): CheckIn => ({
  date,
  sleepHours: 8,
  sleepQuality: 5,
  soreness: 1,
  energy: 5,
});
const bad = (date: string): CheckIn => ({
  date,
  sleepHours: 4,
  sleepQuality: 1,
  soreness: 5,
  energy: 1,
});
/** Lands in the 'easy' band rather than at either extreme. */
const middling = (date: string): CheckIn => ({
  date,
  sleepHours: 6.2,
  sleepQuality: 3,
  soreness: 3,
  energy: 3,
});

function athlete(id: string, checkIns: CheckIn[], sessions: Session[] = []): AthleteData {
  return { athlete: { id, name: id }, checkIns, sessions };
}

describe('buildRosterEntry triage', () => {
  it('flags an athlete whose readiness is in the rest band', () => {
    const e = buildRosterEntry(athlete('a', [bad(TODAY)]), TODAY);
    expect(e.status).toBe('flag');
    expect(e.reason).toMatch(/asking for a day off/);
  });

  it('watches an athlete in the easy band', () => {
    const e = buildRosterEntry(athlete('a', [middling(TODAY)]), TODAY);
    expect(e.readiness.band).toBe('easy');
    expect(e.status).toBe('watch');
  });

  it('marks a fresh athlete ok with no reason to surface', () => {
    const e = buildRosterEntry(athlete('a', [good(TODAY)]), TODAY);
    expect(e.status).toBe('ok');
    expect(e.reason).toBeUndefined();
  });

  it('marks an athlete stale past the check-in window', () => {
    const stale = addDays(TODAY, -(STALE_AFTER_DAYS + 1));
    const e = buildRosterEntry(athlete('a', [good(stale)]), TODAY);
    expect(e.status).toBe('stale');
    expect(e.daysSinceCheckIn).toBe(STALE_AFTER_DAYS + 1);
  });

  it('marks an athlete who has never checked in as stale, not ok', () => {
    const e = buildRosterEntry(athlete('a', []), TODAY);
    expect(e.status).toBe('stale');
    expect(e.reason).toBe('Has never checked in');
  });

  it('does not let a stale athlete read as a green light', () => {
    // A high score from four days ago must not present as ok today.
    const e = buildRosterEntry(athlete('a', [good(addDays(TODAY, -4))]), TODAY);
    expect(e.status).toBe('stale');
  });

  it('still counts an athlete inside the stale window', () => {
    const e = buildRosterEntry(athlete('a', [good(addDays(TODAY, -STALE_AFTER_DAYS))]), TODAY);
    expect(e.status).not.toBe('stale');
  });

  it('flags a repeat overrider even when today looks fine', () => {
    const checkIns: CheckIn[] = [];
    const sessions: Session[] = [];
    for (let i = 20; i >= 1; i--) checkIns.push(bad(addDays(TODAY, -i)));
    [15, 10, 5].forEach((i) =>
      sessions.push({ date: addDays(TODAY, -i), intensity: 'hard', durationMin: 90 }),
    );
    checkIns.push(good(TODAY));

    const e = buildRosterEntry(athlete('a', checkIns, sessions), TODAY);
    expect(e.readiness.band).toBe('go');
    expect(e.recentOverrides).toBe(3);
    expect(e.status).toBe('flag');
    expect(e.reason).toMatch(/3 overrides/);
  });

  it('only watches a single recent override', () => {
    const checkIns: CheckIn[] = [];
    for (let i = 20; i >= 1; i--) checkIns.push(bad(addDays(TODAY, -i)));
    checkIns.push(good(TODAY));
    const sessions: Session[] = [
      { date: addDays(TODAY, -5), intensity: 'hard', durationMin: 90 },
    ];
    const e = buildRosterEntry(athlete('a', checkIns, sessions), TODAY);
    expect(e.recentOverrides).toBe(1);
    expect(e.status).toBe('watch');
  });

  it('ignores overrides older than the counting window', () => {
    const old = OVERRIDE_WINDOW_DAYS + 10;
    const checkIns: CheckIn[] = [];
    for (let i = old; i >= old - 5; i--) checkIns.push(bad(addDays(TODAY, -i)));
    checkIns.push(good(TODAY));
    const sessions: Session[] = [
      { date: addDays(TODAY, -old), intensity: 'hard', durationMin: 90 },
    ];
    const e = buildRosterEntry(athlete('a', checkIns, sessions), TODAY);
    expect(e.recentOverrides).toBe(0);
    expect(e.status).toBe('ok');
  });
});

describe('buildRoster', () => {
  it('sorts the squad into a worklist: flags first, then watch, stale, ok', () => {
    const view = buildRoster(
      [
        athlete('fresh', [good(TODAY)]),
        athlete('gone', [good(addDays(TODAY, -10))]),
        athlete('light', [middling(TODAY)]),
        athlete('wrecked', [bad(TODAY)]),
      ],
      TODAY,
    );
    expect(view.entries.map((e) => e.athlete.id)).toEqual(['wrecked', 'light', 'gone', 'fresh']);
  });

  it('puts the lower score first within the same status', () => {
    const worse: CheckIn = { date: TODAY, sleepHours: 4, sleepQuality: 1, soreness: 5, energy: 1 };
    const lessBad: CheckIn = { date: TODAY, sleepHours: 5, sleepQuality: 2, soreness: 4, energy: 2 };
    const view = buildRoster([athlete('b', [lessBad]), athlete('a', [worse])], TODAY);
    expect(view.entries[0].athlete.id).toBe('a');
  });

  it('counts each status bucket', () => {
    const view = buildRoster(
      [
        athlete('w1', [bad(TODAY)]),
        athlete('w2', [bad(TODAY)]),
        athlete('l1', [middling(TODAY)]),
        athlete('s1', [good(addDays(TODAY, -10))]),
        athlete('ok1', [good(TODAY)]),
      ],
      TODAY,
    );
    expect(view.flagged).toBe(2);
    expect(view.watched).toBe(1);
    expect(view.stale).toBe(1);
  });

  it('excludes stale athletes from the team average', () => {
    // The stale athlete scored 100 four days ago; including them would lift
    // the average and hide the squad's actual state.
    const view = buildRoster(
      [athlete('a', [bad(TODAY)]), athlete('stale', [good(addDays(TODAY, -10))])],
      TODAY,
    );
    expect(view.teamAverage).toBe(0);
  });

  it('has no team average when nobody has usable data', () => {
    const view = buildRoster([athlete('a', []), athlete('b', [])], TODAY);
    expect(view.teamAverage).toBeUndefined();
    expect(view.stale).toBe(2);
  });

  it('handles an empty squad', () => {
    const view = buildRoster([], TODAY);
    expect(view.entries).toEqual([]);
    expect(view.flagged).toBe(0);
    expect(view.teamAverage).toBeUndefined();
  });

  it('keeps each athlete\'s data isolated from the others', () => {
    const loaded = athlete(
      'loaded',
      [good(TODAY)],
      Array.from({ length: 28 }, (_, i) => ({
        date: addDays(TODAY, -i),
        intensity: 'max' as const,
        durationMin: 180,
      })),
    );
    const view = buildRoster([loaded, athlete('clean', [good(TODAY)])], TODAY);
    const clean = view.entries.find((e) => e.athlete.id === 'clean');
    expect(clean?.readiness.score).toBe(100);
  });
});

describe('carried-forward readiness', () => {
  it('uses today\'s reading when the athlete has checked in', () => {
    const e = buildRosterEntry(athlete('a', [good(addDays(TODAY, -1)), bad(TODAY)]), TODAY);
    expect(e.readinessAgeDays).toBe(0);
    expect(e.readinessAsOf).toBe(TODAY);
    expect(e.readiness.score).toBe(0);
  });

  it('carries yesterday\'s reading forward when today is empty', () => {
    const e = buildRosterEntry(athlete('a', [bad(addDays(TODAY, -1))]), TODAY);
    expect(e.readinessAgeDays).toBe(1);
    expect(e.readinessAsOf).toBe(addDays(TODAY, -1));
    expect(e.readiness.score).toBe(0);
    expect(e.status).toBe('flag');
  });

  it('does not carry a reading forward past the stale window', () => {
    const e = buildRosterEntry(athlete('a', [good(addDays(TODAY, -(STALE_AFTER_DAYS + 1)))]), TODAY);
    expect(e.status).toBe('stale');
    expect(e.readinessAsOf).toBeUndefined();
    expect(Number.isFinite(e.readinessAgeDays)).toBe(false);
  });

  it('prefers the most recent usable day, not the oldest in the window', () => {
    const e = buildRosterEntry(
      athlete('a', [bad(addDays(TODAY, -3)), good(addDays(TODAY, -1))]),
      TODAY,
    );
    expect(e.readinessAsOf).toBe(addDays(TODAY, -1));
    expect(e.readiness.score).toBe(100);
  });

  it('keeps a carried-forward athlete in the worklist rather than hiding them', () => {
    // A coach at 7am, before anyone has checked in today, must still see who
    // was struggling yesterday.
    const view = buildRoster(
      [athlete('hurt', [bad(addDays(TODAY, -1))]), athlete('fine', [good(addDays(TODAY, -1))])],
      TODAY,
    );
    expect(view.entries[0].athlete.id).toBe('hurt');
    expect(view.flagged).toBe(1);
    expect(view.stale).toBe(0);
    expect(view.teamAverage).toBe(50);
  });
});
