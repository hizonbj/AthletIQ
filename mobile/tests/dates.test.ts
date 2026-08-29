import { describe, expect, it } from 'vitest';
import { addDays, dayRange, daysBetween, parseDay, toDayISO } from '@/domain/dates';

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
