import { describe, expect, it } from 'vitest';
import {
  BACKUP_VERSION,
  exportBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from '@/data/backup';
import { InMemoryRepository } from '@/data/repository';
import type { CheckIn, Session } from '@/domain/types';

const CHECK_INS: CheckIn[] = [
  { date: '2026-08-28', sleepHours: 7.5, sleepQuality: 4, soreness: 2, energy: 4, restingHr: 51 },
  { date: '2026-08-29', sleepHours: 6, soreness: 4 },
];
const SESSIONS: Session[] = [
  { date: '2026-08-28', intensity: 'hard', durationMin: 90, rpe: 8 },
  { date: '2026-08-29', intensity: 'easy', durationMin: 30, notes: 'shakeout' },
];

describe('export and restore round-trip', () => {
  it('preserves every record through serialize, parse and restore', async () => {
    const source = new InMemoryRepository({ checkIns: CHECK_INS, sessions: SESSIONS });
    const text = serializeBackup(await exportBackup(source));

    const { backup, skipped } = parseBackup(text);
    expect(skipped).toBe(0);

    const target = new InMemoryRepository();
    const result = await restoreBackup(target, backup);
    expect(result).toEqual({ checkInsRestored: 2, sessionsRestored: 2 });

    expect(await target.getCheckIns()).toEqual(await source.getCheckIns());
    expect(await target.getSessions()).toEqual(await source.getSessions());
  });

  it('replaces rather than merges, so a restore cannot duplicate sessions', async () => {
    // Merging would double the training load and corrupt every score after it.
    const target = new InMemoryRepository({ checkIns: CHECK_INS, sessions: SESSIONS });
    const { backup } = parseBackup(
      serializeBackup(await exportBackup(new InMemoryRepository({ checkIns: [], sessions: [] }))),
    );
    await restoreBackup(target, backup);
    expect(await target.getSessions()).toEqual([]);
    expect(await target.getCheckIns()).toEqual([]);
  });

  it('stamps the current version and an export time', async () => {
    const backup = await exportBackup(new InMemoryRepository());
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
  });
});

describe('parseBackup rejects what is not a backup', () => {
  it('throws on invalid JSON', () => {
    expect(() => parseBackup('{not json')).toThrow(/not valid JSON/);
  });

  it('throws on JSON that is not an object', () => {
    expect(() => parseBackup('[1,2,3]')).toThrow(/not an AthletIQ backup/);
    expect(() => parseBackup('"hello"')).toThrow(/not an AthletIQ backup/);
    expect(() => parseBackup('null')).toThrow(/not an AthletIQ backup/);
  });

  it('throws when the version is missing', () => {
    expect(() => parseBackup('{"checkIns":[],"sessions":[]}')).toThrow(/not an AthletIQ backup/);
  });

  it('refuses a backup from a newer version rather than dropping its data', () => {
    const text = JSON.stringify({ version: 99, checkIns: [], sessions: [] });
    expect(() => parseBackup(text)).toThrow(/newer version/);
  });

  it('throws when the record arrays are missing', () => {
    expect(() => parseBackup('{"version":1}')).toThrow(/missing its records/);
    expect(() => parseBackup('{"version":1,"checkIns":[]}')).toThrow(/missing its records/);
  });
});

describe('parseBackup skips malformed records instead of coercing them', () => {
  function withRecords(checkIns: unknown[], sessions: unknown[]): string {
    return JSON.stringify({ version: 1, exportedAt: '2026-08-29T00:00:00Z', checkIns, sessions });
  }

  it('drops a check-in with no usable date', () => {
    const { backup, skipped } = parseBackup(
      withRecords([{ date: 'not-a-date', sleepHours: 8 }, { date: '2026-08-29' }], []),
    );
    expect(backup.checkIns).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('drops a session with an unknown intensity', () => {
    const { backup, skipped } = parseBackup(
      withRecords([], [{ date: '2026-08-29', intensity: 'ultra', durationMin: 60 }]),
    );
    expect(backup.sessions).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('drops a session with no duration, which would break load entirely', () => {
    const { backup, skipped } = parseBackup(
      withRecords([], [{ date: '2026-08-29', intensity: 'easy' }]),
    );
    expect(backup.sessions).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('discards an out-of-range field but keeps the record', () => {
    const { backup } = parseBackup(
      withRecords([{ date: '2026-08-29', sleepHours: 99, soreness: 3, restingHr: 900 }], []),
    );
    expect(backup.checkIns[0].sleepHours).toBeUndefined();
    expect(backup.checkIns[0].restingHr).toBeUndefined();
    expect(backup.checkIns[0].soreness).toBe(3);
  });

  it('rejects a numeric field arriving as a string rather than coercing it', () => {
    const { backup } = parseBackup(withRecords([{ date: '2026-08-29', sleepHours: '8' }], []));
    expect(backup.checkIns[0].sleepHours).toBeUndefined();
  });

  it('drops unknown fields from a newer minor format without failing', () => {
    const { backup, skipped } = parseBackup(
      withRecords([{ date: '2026-08-29', soreness: 2, hydration: 7 }], []),
    );
    expect(skipped).toBe(0);
    expect(backup.checkIns[0]).not.toHaveProperty('hydration');
    expect(backup.checkIns[0].soreness).toBe(2);
  });

  it('drops a null entry in either array', () => {
    const { backup, skipped } = parseBackup(withRecords([null, 'x'], [null]));
    expect(backup.checkIns).toHaveLength(0);
    expect(backup.sessions).toHaveLength(0);
    expect(skipped).toBe(3);
  });

  it('rejects a structurally valid but impossible date', () => {
    const { skipped } = parseBackup(withRecords([{ date: '2026-13-45' }], []));
    expect(skipped).toBe(1);
  });
});

describe('session identity', () => {
  it('assigns an id to every stored session, including seeded ones', async () => {
    const repo = new InMemoryRepository({ checkIns: [], sessions: SESSIONS });
    const stored = await repo.getSessions();
    expect(stored.every((s) => typeof s.id === 'string' && s.id.length > 0)).toBe(true);
    expect(new Set(stored.map((s) => s.id)).size).toBe(stored.length);
  });

  it('assigns an id on add', async () => {
    const repo = new InMemoryRepository();
    await repo.addSession({ date: '2026-08-29', intensity: 'easy', durationMin: 30 });
    const [stored] = await repo.getSessions();
    expect(stored.id).toBeDefined();
  });

  it('deletes only the session addressed', async () => {
    const repo = new InMemoryRepository({ checkIns: [], sessions: SESSIONS });
    const before = await repo.getSessions();
    await repo.deleteSession(before[0].id as string);
    const after = await repo.getSessions();
    expect(after).toHaveLength(before.length - 1);
    expect(after.map((s) => s.id)).not.toContain(before[0].id);
  });

  it('ignores a delete for an unknown id rather than throwing', async () => {
    const repo = new InMemoryRepository({ checkIns: [], sessions: SESSIONS });
    await expect(repo.deleteSession('does-not-exist')).resolves.toBeUndefined();
    expect(await repo.getSessions()).toHaveLength(SESSIONS.length);
  });

  it('does not carry ids into a backup file, since they are storage-local', async () => {
    // Ids are assigned by whichever store holds the data; restoring into a
    // different device must not try to preserve the old ones.
    const repo = new InMemoryRepository({ checkIns: [], sessions: SESSIONS });
    const { backup } = parseBackup(serializeBackup(await exportBackup(repo)));
    expect(backup.sessions.every((s) => s.id === undefined)).toBe(true);
  });

  it('re-assigns fresh ids when a backup is restored', async () => {
    const source = new InMemoryRepository({ checkIns: [], sessions: SESSIONS });
    const { backup } = parseBackup(serializeBackup(await exportBackup(source)));
    const target = new InMemoryRepository();
    await restoreBackup(target, backup);
    const restored = await target.getSessions();
    expect(restored).toHaveLength(SESSIONS.length);
    expect(restored.every((s) => typeof s.id === 'string')).toBe(true);
  });
});

describe('legacy sessions without ids', () => {
  it('are given ids so they can be deleted', async () => {
    // Sessions written before identity existed would otherwise be permanently
    // undeletable, which is exactly the mis-logged data people need to remove.
    const repo = new InMemoryRepository({
      checkIns: [],
      sessions: [
        { date: '2026-08-28', intensity: 'hard', durationMin: 90 },
        { date: '2026-08-29', intensity: 'easy', durationMin: 30 },
      ],
    });
    const stored = await repo.getSessions();
    expect(stored.every((s) => s.id)).toBe(true);
    await repo.deleteSession(stored[0].id as string);
    expect(await repo.getSessions()).toHaveLength(1);
  });
});
