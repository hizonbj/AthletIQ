/**
 * Public URLs.
 *
 * App Store guideline 3.1.2 requires a subscription screen to carry tappable
 * links to the Terms of Use and Privacy Policy — in the app itself, not only in
 * the store listing. A reviewer who cannot tap through to the document rejects
 * the build, and it is one of the most common subscription rejections there is.
 *
 * These point at GitHub Pages for the repo. If the site moves, this is the only
 * file that changes.
 */
export const SITE = 'https://hizonbj.github.io/AthletIQ';

export const PRIVACY_URL = `${SITE}/privacy.html`;
export const TERMS_URL = `${SITE}/terms.html`;
export const SUPPORT_URL = `${SITE}/support.html`;

/** Apple's standard EULA, which the Terms page also points at. */
export const APPLE_EULA_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
