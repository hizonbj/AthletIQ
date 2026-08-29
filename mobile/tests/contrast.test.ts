import { describe, expect, it } from 'vitest';
import { bandColors, colors } from '@/ui/theme';

/**
 * WCAG relative luminance and contrast ratio.
 *
 * Contrast is the one visual property that can be checked without a device, and
 * the one most likely to drift as a palette gets adjusted by eye — the tertiary
 * text colour originally measured 4.10:1 on a card, which reads fine to someone
 * with good vision in a dark room and fails for everyone else.
 */
function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const channels = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Every surface text can sit on. The lightest is the hardest case. */
const SURFACES = [colors.bg, colors.surface, colors.surfaceSunken, colors.surfaceRaised];

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

describe('contrast ratios', () => {
  it('sanity-checks the ratio function against known values', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('meets AA for normal text on every surface', () => {
    for (const surface of SURFACES) {
      for (const [name, color] of [
        ['text', colors.text],
        ['textSecondary', colors.textSecondary],
        ['textTertiary', colors.textTertiary],
      ] as const) {
        const ratio = contrastRatio(color, surface);
        expect(ratio, `${name} on ${surface}`).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    }
  });

  it('meets AA for the accent, which carries link and button labels', () => {
    for (const surface of SURFACES) {
      expect(contrastRatio(colors.accent, surface), `accent on ${surface}`)
        .toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it('meets AA for every band colour, since they carry the verdict', () => {
    for (const surface of SURFACES) {
      for (const [band, color] of Object.entries(bandColors)) {
        expect(contrastRatio(color, surface), `${band} on ${surface}`)
          .toBeGreaterThanOrEqual(AA_NORMAL);
      }
    }
  });

  it('keeps the filled-button label readable on its own fill', () => {
    // Primary buttons put near-black text on the accent, and band-tinted CTAs
    // put it on a band colour.
    const buttonLabel = '#03121F';
    for (const fill of [colors.accent, ...Object.values(bandColors)]) {
      expect(contrastRatio(buttonLabel, fill), `label on ${fill}`)
        .toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});
