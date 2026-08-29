/**
 * Design tokens.
 *
 * Dark-first, because this app is opened at 6am in a dark bedroom. The palette
 * is built around one idea: the readiness band is the only saturated colour on
 * screen at any moment, so the answer is legible before any text is read.
 */
import type { Band } from '@/domain/types';

export const colors = {
  /** Near-black with a blue cast — easier on waking eyes than pure black. */
  bg: '#080B10',
  surface: '#12171F',
  surfaceRaised: '#1A212B',
  surfaceSunken: '#0C1116',
  border: '#232C38',
  borderStrong: '#33404F',

  text: '#F2F6FA',
  textSecondary: '#A4B2C2',
  /**
   * Lightened from #6B7A8C, which measured 4.10:1 on a card — under the 4.5:1
   * WCAG AA floor for normal text, and this is the colour captions, labels and
   * hints use. Now 4.60:1 on the lightest surface it sits on.
   */
  textTertiary: '#7B8A9C',

  accent: '#4DA3FF',
  accentSoft: '#12283F',
};

/** One colour per readiness band. These carry the entire semantic load. */
export const bandColors: Record<Band, string> = {
  rest: '#FF4D5E',
  easy: '#FFA83D',
  moderate: '#4DA3FF',
  go: '#2FD98A',
};

/** Dimmed band colours, for fills and trails behind the primary mark. */
export const bandColorsDim: Record<Band, string> = {
  rest: '#3A1620',
  easy: '#3A2A14',
  moderate: '#13283F',
  go: '#0F3328',
};

export const bandCopy: Record<Band, { title: string; detail: string }> = {
  rest: { title: 'Rest', detail: 'Your numbers are asking for a day off.' },
  easy: { title: 'Easy', detail: 'Movement is fine. Keep it conversational.' },
  moderate: { title: 'Moderate', detail: 'Solid work is on. Leave a little in the tank.' },
  go: { title: 'Go', detail: 'You are recovered. Take the hard session.' },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

/**
 * Bottom padding a scrolling tab screen needs so its last card clears the tab
 * bar. The bar is 88pt plus breathing room.
 */
export const TAB_BAR_CLEARANCE = 112;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

/**
 * Type scale. Sizes are deliberately few — a screen that uses three of these
 * reads as designed; one that uses six reads as a form.
 */
export const type = {
  display: { fontSize: 64, fontWeight: '800' as const, letterSpacing: -2 },
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  label: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
};

/** Motion. One spring for everything that moves, so the app feels coherent. */
export const motion = {
  spring: { damping: 18, stiffness: 140, mass: 0.9 },
  springSnappy: { damping: 22, stiffness: 260, mass: 0.7 },
  duration: { fast: 160, normal: 260, slow: 420, count: 900 },
};
