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

| | Free | Pro |
|---|---|---|
| Today's score and what is limiting it | Yes | Yes |
| Logging | Yes | Yes |
| History | 7 days | Everything |
| Override log | — | Yes |
| What each override cost | — | Yes |
| Pre-session warning | — | Yes |

$9.99/mo or $69.99/yr. The score stays free permanently — charging for it
invites a comparison with hardware we lose.

## Layout

```
src/domain/      pure TypeScript, no React or native imports
  types.ts       shared records
  dates.ts       UTC day arithmetic
  load.ts        session-RPE load and acute:chronic ratio
  readiness.ts   signal normalization and weighted scoring
  override.ts    detection, outcome settlement, pattern aggregation
  insights.ts    replays history and applies entitlement gating
src/data/        Repository interface, SQLite (native), localStorage (web)
src/subscription/entitlements and the PurchaseStore interface
src/ui/          theme, shared components, app state provider
app/             expo-router screens
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
npm test           # 80 unit tests
npm run typecheck
```

`npm start` with `w` runs in a browser against the localStorage repository —
`expo-sqlite` is native-only, so the platform factory in `src/data/factory.ts`
swaps backends automatically.

## Before shipping

- `MockPurchaseStore` is a development stub. Implement `PurchaseStore` against
  RevenueCat or StoreKit; no caller changes.
- Wire HealthKit / Health Connect so sleep and resting HR arrive without typing.
- Add app icon and splash assets.

## A deliberate constraint

Data stays on the device, and the app does not diagnose, treat, or predict
injury. Framing this as injury-risk prediction would pull it toward medical-claim
territory and App Store health review. It is a training-decision log, which is
both safer and the more differentiated product.
