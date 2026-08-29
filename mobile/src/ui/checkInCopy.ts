/**
 * Colour mapping for the check-in scales. The words themselves live in
 * `@/domain/scales`, because they define the scale rather than decorate it.
 */
import { bandColors } from './theme';

export {
  ENERGY_WORDS,
  SLEEP_QUALITY_WORDS,
  SORENESS_WORDS,
} from '@/domain/scales';

/** For scales where 5 is good: red at the bottom, green at the top. */
export function colorForUpScale(value: number): string {
  if (value <= 1) return bandColors.rest;
  if (value === 2) return bandColors.easy;
  if (value === 3) return bandColors.moderate;
  return bandColors.go;
}

/** For scales where 5 is bad (soreness): the mapping inverts. */
export function colorForDownScale(value: number): string {
  return colorForUpScale(6 - value);
}
