import { describe, expect, it } from 'vitest';
import {
  ENERGY_WORDS,
  SLEEP_QUALITY_WORDS,
  SORENESS_WORDS,
  wordFor,
} from '@/domain/scales';

describe('wordFor', () => {
  it('maps each step to its word', () => {
    expect(wordFor(SLEEP_QUALITY_WORDS, 1)).toBe('Terrible');
    expect(wordFor(SLEEP_QUALITY_WORDS, 5)).toBe('Great');
    expect(wordFor(SORENESS_WORDS, 3)).toBe('Noticeable');
    expect(wordFor(ENERGY_WORDS, 2)).toBe('Low');
  });

  it('clamps out-of-range values rather than returning undefined', () => {
    expect(wordFor(ENERGY_WORDS, 0)).toBe('Drained');
    expect(wordFor(ENERGY_WORDS, 9)).toBe('Flying');
    expect(wordFor(ENERGY_WORDS, -3)).toBe('Drained');
  });

  it('rounds a fractional value to the nearest step', () => {
    expect(wordFor(ENERGY_WORDS, 3.4)).toBe('OK');
    expect(wordFor(ENERGY_WORDS, 3.6)).toBe('Good');
  });

  it('every scale names all five steps', () => {
    for (const words of [SLEEP_QUALITY_WORDS, SORENESS_WORDS, ENERGY_WORDS]) {
      expect(words).toHaveLength(5);
      expect(new Set(words).size).toBe(5);
    }
  });
});
