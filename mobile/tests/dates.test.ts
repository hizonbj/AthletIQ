import { describe, expect, it } from 'vitest';
import { addDays, dayRange, daysBetween, localDayISO, parseDay, toDayISO } from '@/domain/dates';

describe('date helpers', () => {
  it('round-trips a Date to an ISO day', () => {
    expect(toDayISO(new Date('2026-08-29T13:45:00Z'))).toBe('2026-08-29');
  });

  it('counts whole days between dates', () => {
    expect(daysBetween('2026-08-01', '2026-08-29')).toBe(28);
    expect(daysBetween('2026-08-29', '2026-08-01')).toBe(-28);
    expect(daysBetween('2026-08-29', '2026-08-29')).toBe(0);
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('builds an inclusive ascending range', () => {
    expect(dayRange('2026-08-27', '2026-08-29')).toEqual([
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
    ]);
  });

  it('rejects an unparseable day', () => {
    expect(() => parseDay('not-a-date')).toThrow(/Invalid DayISO/);
  });
});

describe('localDayISO', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // 11:30pm on Aug 29 in Los Angeles is Aug 30 in UTC. A session logged then
    // belongs to the athlete's Saturday evening, not to Sunday.
    const lateEveningPDT = new Date('2026-08-29T23:30:00-07:00');
    expect(toDayISO(lateEveningPDT)).toBe('2026-08-30');
    expect(localDayISO(lateEveningPDT)).toBe(
      formatLocal(lateEveningPDT),
    );
  });

  it('agrees with the device calendar for an instant on either side of UTC', () => {
    for (const iso of [
      '2026-08-29T23:30:00-07:00', // late evening, western offset
      '2026-08-29T07:00:00+10:00', // early morning, eastern offset
      '2026-01-01T00:30:00+13:00', // new year across the date line
      '2026-12-31T23:59:00-05:00',
    ]) {
      const d = new Date(iso);
      expect(localDayISO(d)).toBe(formatLocal(d));
    }
  });

  it('pads month and day to two digits', () => {
    const d = new Date(2026, 0, 5, 12, 0, 0); // 5 Jan 2026, local
    expect(localDayISO(d)).toBe('2026-01-05');
  });

  it('produces a label the day arithmetic accepts', () => {
    const label = localDayISO(new Date(2026, 7, 29, 23, 30));
    expect(() => parseDay(label)).not.toThrow();
    expect(daysBetween(label, addDays(label, 3))).toBe(3);
  });

  it('defaults to now', () => {
    expect(localDayISO()).toBe(formatLocal(new Date()));
  });
});

/** What the device's own calendar says, independent of the implementation. */
function formatLocal(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}
