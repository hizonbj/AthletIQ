# AthletIQ (mobile)

An Expo / React Native app built on one bet: **the readiness score is not the
product.**

Every wearable already gives you a recovery number for free. Nobody keeps a
record of the mornings that number said back off and you trained anyway — and
what that decision actually cost you. That record is what people pay for, and it
is the only thing here that gets more valuable the longer someone stays
subscribed.

## The mechanic

1. You check in. Sleep, soreness, energy, resting HR — whatever you have.
2. You get a readiness score and the intensity it endorses.
3. You log a session. If it is harder than endorsed, that is an **override**,
   and it goes on the record.
4. Three days later we settle it: your readiness in the days after, against
   your own trailing baseline. That difference is the **cost**.
5. Next time you reach for a hard session on a low day, you are told what the
   last four cost you — before the session, not after.

## Free vs Pro

| | Free | Pro | Coach |
|---|---|---|---|
| Today's score and what is limiting it | Yes | Yes | Yes |
| Logging | Yes | Yes | Yes |
| History | 7 days | Everything | Everything |
| Override log | — | Yes | Yes |
| What each override cost | — | Yes | Yes |
| Pre-session warning | — | Yes | Yes |
| Squad roster | — | — | Yes |

Pro is $9.99/mo or $69.99/yr. Coach is $12/athlete/mo — a 20-athlete squad is
worth roughly twenty consumers, and clubs churn far less than individuals.

The score stays free permanently. Charging for it invites a comparison with
hardware we lose.

## The coach roster

The same engine pointed at a squad. It produces a worklist, not a leaderboard:
athletes are sorted by who needs a conversation first — flagged for a rest-band
reading or for repeat overrides in the trailing 30 days, so someone quietly
grinding through low days surfaces even when today looks fine.

Readiness is carried forward from the most recent real reading within three
days, labelled with its age. Scoring only the current day made every athlete
read as "no data" at 7am before anyone had checked in, which made the screen
useless exactly when a coach opens it. Past that window they show a dash, and
they are excluded from the squad average rather than inflating it.

## Layout

```
src/domain/      pure TypeScript, no React or native imports
  types.ts       shared records
  dates.ts       UTC day arithmetic
  load.ts        session-RPE load and acute:chronic ratio
  readiness.ts   signal normalization and weighted scoring
  override.ts    detection, outcome settlement, pattern aggregation
  insights.ts    replays history and applies entitlement gating
  roster.ts      squad triage for the coach view
src/data/        Repository interface, SQLite (native), localStorage (web)
src/health/      HealthProvider seam, pure aggregation and merge rules,
                 HealthKit (iOS) and Health Connect (Android) adapters
src/subscription/entitlements, PurchaseStore, and the RevenueCat adapter
src/ui/          design tokens, shared components, input controls, app state
app/             expo-router screens; (tabs)/ are the three peers
```

The domain layer imports nothing from React Native, which is why it is testable
in Node without a simulator. Screens read gated values through `insights.ts` and
never decide entitlement themselves.

## How the score works

Each signal is normalized to 0..1, then combined as a weighted mean:

| Signal | Weight | Ideal |
|---|---|---|
| Sleep duration | 3 | 7.5–9.5 h |
| Soreness | 3 | low |
| Training load (ACWR) | 3 | at or below 1.3 |
| Sleep quality | 2 | high |
| Energy | 2 | high |
| Resting HR | 2 | at or below personal baseline |

Missing signals are dropped and the remaining weights renormalized, so a partial
check-in still yields an honest number. `confidence` reports how much of the
model had data behind it, and the UI shows a dash rather than a number when
nothing has been logged.

Two decisions worth knowing about:

- **A low acute:chronic ratio is not penalized.** Being undertrained means being
  fresh. Only ramping faster than your conditioning (above 1.3) costs you.
- **Resting HR needs five prior readings** before it counts, so a first-morning
  measurement cannot define its own baseline.

## Running it

```bash
npm install
npm start          # Expo dev server; press i / a / w
npm test           # 176 unit tests
npm run typecheck
```

`npm start` with `w` runs in a browser against the localStorage repository —
`expo-sqlite` is native-only, so the platform factory in `src/data/factory.ts`
swaps backends automatically.

## Payments

`src/subscription/revenueCat.ts` implements `PurchaseStore` against RevenueCat.
The decisions live in `revenueCatMapping.ts` — which entitlement wins, what
counts as a cancellation — and are unit tested; the class around them is SDK
plumbing.

To switch off the development stub:

1. Create the `pro` and `coach` entitlements in the RevenueCat dashboard. The
   ids in `revenueCatMapping.ts` must match those entitlements, not the store
   product ids.
2. Build the offering with monthly, annual and per-athlete packages.
3. Pass `RevenueCatPurchaseStore` into `AppStateProvider` with your iOS and
   Android API keys.
4. Run on a development build. This path cannot work in Expo Go or on web.

## Health import

`Import from Health` fills gaps in a check-in from the platform health store.
One rule governs it: **what the athlete typed wins.** Imported values only ever
fill a blank, and implausible readings (sleep outside 0.5–16h, resting HR
outside 25–120bpm) are discarded. Sleep trackers are wrong often enough that
silently overwriting someone's own account of their night would make readiness
less trustworthy, not more.

Sleep is attributed to the morning the athlete woke up, so a night starting at
23:00 counts toward the next day's check-in.

**Android imports sleep and resting HR. iOS imports resting HR only.** Sleep is
a HealthKit category sample, and the newest `@kingstinct/react-native-healthkit`
that still supports React 18 (10.x) exposes no category query. Lifting this
needs React 19, which needs a newer Expo SDK. It is a deliberate deferral, and
because everything sits behind `HealthProvider`, only `healthKit.ts` changes
when you take it.

Both adapters need a development build, HealthKit enabled with Info.plist usage
strings on iOS, and Health Connect permissions in the manifest on Android.

## Interface

Three decisions shape the whole app:

**No keyboard in the daily loop.** The check-in is one question per screen,
answered with a single tap that advances automatically — four taps and a scrub,
start to finish. Sleep is a scrubbing ruler in 15-minute detents rather than a
number field, because typing "7.5" at 6am demands precision nobody has about
their own sleep and raises a keyboard over the screen to get it.

**Scales are words, not numbers.** "Soreness: 3" forces the athlete to invent a
private rubric and apply it consistently for months, which nobody does. Every
step is named — None, Slight, Noticeable, Sore, Very sore — and the same words
come back everywhere the value is displayed. They live in `domain/scales.ts`,
because naming the steps is the definition of the scale, not styling.

**One saturated colour at a time.** The readiness band owns it, so the verdict
registers before any text is read. The ring sweeps and the number counts up on
mount: a score that simply appears reads as a label, one that arrives reads as a
measurement just taken.

Everything tappable scales toward the finger and fires a haptic on touch —
physical confirmation is what makes an app feel fast. Navigation is three tabs
rather than pushes from Today, which had buried the paid screens two taps deep.

## Before shipping

- Swap `MockPurchaseStore` for `RevenueCatPurchaseStore` (above).
- Give the roster a real backend. It is in-memory on device today, because a
  coach squad syncs from a server in any real deployment and persisting it
  locally would be the wrong shape to build on.
- Add app icon and splash assets.

## What is verified, and what is not

Everything in `src/domain`, `src/health` (aggregation, merge, import
orchestration) and `src/subscription` (entitlements, RevenueCat mapping) is
covered by the 159 unit tests and runs in CI without a device.

The native adapters — `revenueCat.ts`, `healthKit.ts`, `healthConnect.ts` — are
typechecked against the real SDK type definitions, which catches API misuse, but
they have not been run against a device or a live store account. Test those on a
development build before trusting them.

## A deliberate constraint

Data stays on the device, and the app does not diagnose, treat, or predict
injury. Framing this as injury-risk prediction would pull it toward medical-claim
territory and App Store health review. It is a training-decision log, which is
both safer and the more differentiated product.
