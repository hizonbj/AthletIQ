/**
 * Sends a first-time athlete to the intro before anything else.
 *
 * Done as a redirect once preferences have loaded rather than as a conditional
 * render, so the tab bar and Today screen never flash behind the intro.
 */
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useApp } from './AppState';

export function useFirstRunRedirect() {
  const { ready, prefs } = useApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!ready || prefs.onboarded) return;
    // Already inside the intro or the check-in it leads to: leave it alone,
    // otherwise finishing onboarding would bounce straight back here.
    const current = segments[0];
    if (current === 'onboarding' || current === 'checkin') return;
    router.replace('/onboarding');
  }, [ready, prefs.onboarded, router, segments]);
}
