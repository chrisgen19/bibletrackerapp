# Chapter

An offline-first daily Bible reading tracker for iOS. One chapter a day, tracked on a
monthly calendar.

No account, no backend, no network calls. SQLite on the device is the source of truth.

## Running

```bash
pnpm install
pnpm ios          # builds and launches a development build
```

Requires Node 20+, Xcode, and CocoaPods.

**Expo Go will not run this app.** `@react-native-community/datetimepicker` is not
bundled in Expo Go, so a development build is required. `pnpm ios` handles it: it
prebuilds the native `ios/` directory (gitignored), runs `pod install`, then builds and
launches on the simulator. The first run takes several minutes; later runs are fast.

`pnpm start` alone only serves the JS bundle — useful once a development build is
already installed.

SF Symbols render natively on iOS; other platforms fall back to bundled vector icons.

## Verifying

```bash
pnpm verify       # typecheck + lint + tests
```

Individually: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Architecture

Feature-first, with a strict one-way dependency direction:

```
src/app/            Expo Router routes — thin, no business logic
  └── features/*/hooks/        React state and use cases
        └── features/*/domain/ pure TypeScript, zero React Native imports
        └── features/*/data/   repositories (the only place SQL lives)
              └── db/          Drizzle schema + client
                    └── expo-sqlite
```

| Directory | Responsibility |
| --- | --- |
| `src/data/bible` | Canon metadata. `Canon` is an interface; `PROTESTANT_CANON` is one implementation. |
| `src/features/reading-plan/domain` | Chapter progression, schedule derivation, plan validation. |
| `src/features/progress/domain` | Streaks, monthly statistics, calendar grid maths. |
| `src/db` | Drizzle schema, migrations, repositories, settings. |
| `src/theme` | Design tokens and the theme provider. |
| `src/components` | Shared UI primitives. |

### Design decisions worth knowing

**Scheduled readings are never stored.** A day's chapter is derived from
`(plan.startDate, startReference, chaptersPerDay, targetDate)`. A three-year plan costs
one database row, and future months can be previewed indefinitely.

**Chapter maths is O(log n).** `CanonIndex` projects every chapter onto a single
0-based axis (Genesis 1 = 0 … Revelation 22 = 1188). Progression becomes integer
addition; mapping back to a book is a binary search over cumulative chapter counts.
Book boundaries — Genesis 50 → Exodus 1, Malachi 4 → Matthew 1, Revelation 22 → done —
fall out for free rather than needing special cases.

**Plans are append-only segments.** Changing your reading position closes the current
segment (`end_date`, `is_active = 0`) and opens a new one. Nothing that governed a past
date is ever rewritten, so historical progress cannot silently change. Completion rows
snapshot their own `book_id`/`chapter`, so a completed day keeps showing what was
actually read.

**Onboarding has no completion flag.** The presence of an active plan *is* the marker,
which makes "onboarded but no plan" unrepresentable.

**Local calendar days, not timestamps.** Every day boundary is a `YYYY-MM-DD` string in
the user's timezone, and day arithmetic runs on local-noon anchors so daylight saving
transitions cannot shift a day. A reading marked at 11:50 PM belongs to the day the
user experienced it.

**Missed days are never red.** The calendar uses a soft neutral fill. The product should
encourage consistency, not scold.

## Database

Schema lives in `src/db/schema.ts`. After changing it:

```bash
pnpm db:generate
```

This writes a new migration to `drizzle/`. Migrations run at startup before any
data-dependent screen renders; failures surface as a plain-language recovery screen.

`babel-plugin-inline-import` embeds the generated `.sql` files as strings at build time —
without it Metro tries to parse them as JavaScript.

## Testing

146 tests, weighted toward domain behaviour rather than snapshots. Tests live in
`__tests__` folders beside the code they cover, and never inside `src/app`.

Note that React Native Testing Library 14 made `render` **asynchronous** — component
tests must `await renderWithTheme(...)` before querying.
