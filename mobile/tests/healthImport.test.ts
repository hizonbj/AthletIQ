import { describe, expect, it } from 'vitest';
import { importHealthData } from '@/health/import';
import { InMemoryRepository } from '@/data/repository';
import type { HealthProvider, HealthSample } from '@/health/types';
import type { DayISO } from '@/domain/types';

const TODAY = '2026-08-29';

class FakeProvider implements HealthProvider {
  readCalls: { from: DayISO; to: DayISO }[] = [];

  constructor(
    private readonly opts: {
      available?: boolean;
      granted?: boolean;
      samples?: HealthSample[];
    } = {},
  ) {}

  async isAvailable() {
    return this.opts.available ?? true;
  }
  async requestPermissions() {
    return this.opts.granted ?? true;
  }
  async read(from: DayISO, to: DayISO) {
    this.readCalls.push({ from, to });
    return this.opts.samples ?? [];
  }
}

describe('importHealthData', () => {
  it('reports unavailable without prompting for permission', async () => {
    const provider = new FakeProvider({ available: false });
    const result = await importHealthData(provider, new InMemoryRepository(), TODAY);
    expect(result).toEqual({ status: 'unavailable', filledCount: 0 });
    expect(provider.readCalls).toHaveLength(0);
  });

  it('reports denied and reads nothing when permission is refused', async () => {
    const provider = new FakeProvider({ granted: false });
    const result = await importHealthData(provider, new InMemoryRepository(), TODAY);
    expect(result).toEqual({ status: 'denied', filledCount: 0 });
    expect(provider.readCalls).toHaveLength(0);
  });

  it('writes imported values into empty check-ins', async () => {
    const repo = new InMemoryRepository();
    const provider = new FakeProvider({
      samples: [{ date: TODAY, sleepHours: 7.5, restingHr: 52 }],
    });
    const result = await importHealthData(provider, repo, TODAY);
    expect(result.status).toBe('imported');
    expect(result.filledCount).toBe(2);

    const stored = await repo.getCheckIn(TODAY);
    expect(stored?.sleepHours).toBe(7.5);
    expect(stored?.restingHr).toBe(52);
  });

  it('never overwrites what the athlete already entered', async () => {
    const repo = new InMemoryRepository();
    await repo.putCheckIn({ date: TODAY, sleepHours: 6, soreness: 4 });
    const provider = new FakeProvider({
      samples: [{ date: TODAY, sleepHours: 9, restingHr: 52 }],
    });
    const result = await importHealthData(provider, repo, TODAY);

    const stored = await repo.getCheckIn(TODAY);
    expect(stored?.sleepHours).toBe(6);
    expect(stored?.soreness).toBe(4);
    expect(stored?.restingHr).toBe(52);
    expect(result.filledCount).toBe(1);
  });

  it('reports nothing-new when every value is already present', async () => {
    const repo = new InMemoryRepository();
    await repo.putCheckIn({ date: TODAY, sleepHours: 8, restingHr: 50 });
    const provider = new FakeProvider({
      samples: [{ date: TODAY, sleepHours: 7, restingHr: 55 }],
    });
    const result = await importHealthData(provider, repo, TODAY);
    expect(result.status).toBe('nothing-new');
    expect(result.filledCount).toBe(0);
  });

  it('reads an inclusive window ending today', async () => {
    const provider = new FakeProvider();
    await importHealthData(provider, new InMemoryRepository(), TODAY, 7);
    expect(provider.readCalls[0]).toEqual({ from: '2026-08-23', to: TODAY });
  });

  it('leaves the repository untouched when the import is empty', async () => {
    const repo = new InMemoryRepository();
    const result = await importHealthData(new FakeProvider({ samples: [] }), repo, TODAY);
    expect(result.status).toBe('nothing-new');
    expect(await repo.getCheckIns()).toEqual([]);
  });
});
