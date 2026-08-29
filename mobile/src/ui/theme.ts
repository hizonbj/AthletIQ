/** Visual constants. Dark-first: this app is opened at 6am, in bed. */
import type { Band } from '@/domain/types';

export const colors = {
  bg: '#0B0F14',
  surface: '#141A22',
  surfaceAlt: '#1C242E',
  border: '#26313D',
  text: '#E8EDF2',
  textDim: '#8A98A8',
  accent: '#4DA3FF',
  gold: '#F5B843',
};

/** One colour per readiness band, used by the ring and every band label. */
export const bandColors: Record<Band, string> = {
  rest: '#E5484D',
  easy: '#F5B843',
  moderate: '#4DA3FF',
  go: '#3DD68C',
};

export const bandCopy: Record<Band, { title: string; detail: string }> = {
  rest: { title: 'Rest', detail: 'Your numbers are asking for a day off.' },
  easy: { title: 'Easy', detail: 'Movement is fine. Keep it conversational.' },
  moderate: { title: 'Moderate', detail: 'Solid work is on. Leave a little in the tank.' },
  go: { title: 'Go', detail: 'You are recovered. Take the hard session.' },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 12, lg: 20 };
