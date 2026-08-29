import { describe, expect, it } from 'vitest';
import { InMemoryRosterRepository } from '@/data/rosterRepository';

describe('InMemoryRosterRepository', () => {
  it('adds athletes and returns them', async () => {
    const repo = new InMemoryRosterRepository();
    await repo.addAthlete({ id: 'a1', name: 'Sam' });
    const squad = await repo.getSquad();
    expect(squad).toHaveLength(1);
    expect(squad[0].athlete.name).toBe('Sam');
    expect(squad[0].checkIns).toEqual([]);
  });

  it('does not duplicate an athlete already on the squad', async () => {
    const repo = new InMemoryRosterRepository();
    await repo.addAthlete({ id: 'a1', name: 'Sam' });
    await repo.addAthlete({ id: 'a1', name: 'Sam Again' });
    const squad = await repo.getSquad();
    expect(squad).toHaveLength(1);
    expect(squad[0].athlete.name).toBe('Sam');
  });

  it('replaces a check-in for the same date rather than stacking them', async () => {
    const repo = new InMemoryRosterRepository();
    await repo.addAthlete({ id: 'a1', name: 'Sam' });
    await repo.putCheckIn('a1', { date: '2026-08-29', soreness: 1 });
    await repo.putCheckIn('a1', { date: '2026-08-29', soreness: 5 });
    const squad = await repo.getSquad();
    expect(squad[0].checkIns).toHaveLength(1);
    expect(squad[0].checkIns[0].soreness).toBe(5);
  });

  it('keeps each athlete\'s records separate', async () => {
    const repo = new InMemoryRosterRepository();
    await repo.addAthlete({ id: 'a1', name: 'Sam' });
    await repo.addAthlete({ id: 'a2', name: 'Alex' });
    await repo.putCheckIn('a1', { date: '2026-08-29', soreness: 5 });
    const squad = await repo.getSquad();
    expect(squad.find((s) => s.athlete.id === 'a1')?.checkIns).toHaveLength(1);
    expect(squad.find((s) => s.athlete.id === 'a2')?.checkIns).toHaveLength(0);
  });

  it('removes an athlete', async () => {
    const repo = new InMemoryRosterRepository([
      { athlete: { id: 'a1', name: 'Sam' }, checkIns: [], sessions: [] },
    ]);
    await repo.removeAthlete('a1');
    expect(await repo.getSquad()).toHaveLength(0);
  });

  it('rejects writes against an unknown athlete rather than silently dropping them', async () => {
    const repo = new InMemoryRosterRepository();
    await expect(repo.putCheckIn('nope', { date: '2026-08-29' })).rejects.toThrow(/No such athlete/);
    await expect(
      repo.addSession('nope', { date: '2026-08-29', intensity: 'easy', durationMin: 30 }),
    ).rejects.toThrow(/No such athlete/);
  });
});
