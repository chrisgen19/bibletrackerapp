# Bible Daily

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

**Android is not supported in V1.** `pnpm android` and the `android` block in
`app.json` exist because Expo generates them, and the code has no iOS-only APIs — but
nothing has been built or tested on Android, and the layout, haptics and notification
behaviour are unverified there. Treat it as untried rather than working.

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
| `src/features/reading-plan/domain` | Chapter progression, schedule derivation, plan validation, read-throughs, reading classification. |
| `src/features/progress/domain` | Streaks, monthly statistics, calendar grid maths. |
| `src/db` | Drizzle schema, migrations, repositories, settings. |
| `src/theme` | Design tokens and the theme provider. |
| `src/components` | Shared UI primitives. |

### Design decisions worth knowing

**Scheduled readings are never stored.** A day's chapter is derived, not saved: a past
day shows exactly what was recorded on it, and today and later days take the next
chapters from the unread queue, in canon order from the plan's start (any chapter left
part-read behind the start comes first), stepping over what is already read. The
reading position moves when you read, not when the date changes, so a missed day costs
no chapter. A three-year plan still costs one database row, and future months can be
previewed indefinitely.

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

## Reading data

`ReadingDataProvider` (`src/features/reading-plan/hooks`) is the single source of
reading state: every write goes to SQLite first, then the whole snapshot is re-read.
`deriveReadingState` builds what the screens read from that snapshot. Read-throughs and
extra readings came from bibletrackerweb (spec:
[bibletrackerweb#18](https://github.com/chrisgen19/bibletrackerweb/issues/18)) and
behave the same in both apps.

**Read-throughs.** Every plan segment belongs to a numbered time through the Bible
(`domain/read-through.ts`). Plan progress counts the current read-through only: the
unread queue, "Still to finish", chapters read and "You have finished the Bible". The
calendar and streaks count every reading, so nothing is lost. A position change keeps
the read-through; onboarding carries on the latest one (1 for a new reader, and again
after a reset).

**Starting again.** Once the current read-through is finished, a card under today's
offers Start Read-Through #N: Genesis 1 from today, at the same pace. It is the same
close-then-insert as a position change, one read-through on, and deletes nothing.
`startNextReadThrough` re-checks the stored readings inside its transaction, so a
second tap starts nothing. Each segment's finish date is measured in its own
read-through (`getSegmentFinishDates`), so the days between finishing one read-through
and starting the next stay finished rather than missed.

**Extra readings.** A reading can be an extra: shown on its day and counted toward the
streak and month statistics, but it never moves the plan, is never "still to finish",
and never counts toward finishing. Custom-tab logs are classified automatically
(`domain/reading-kind.ts`): finishing a part-read chapter, filling a gap behind the
position, or a chapter within the next week of the queue is a plan reading; a re-read
or a jump further ahead is extra. An extra is saved straight away, and the alert offers
to keep it, or to bring it into the plan: moving the plan on from it ("Move my plan",
one transaction), or just counting it when there is nothing to carry on to. Any reading
can be switched in or out of the plan from the day sheet, and undoing a day keeps its
extras.

**Two schedule contexts.** `scheduleContext` shows every reading on its day (calendar,
streaks, month statistics); `planScheduleContext` shows plan readings only (today's
card, the day sheet, the reading plan screen, Settings), so a day holding only an extra
still offers its plan reading. Both move the plan by the current read-through's plan
readings.

## Database

Schema lives in `src/db/schema.ts`. After changing it:

```bash
pnpm db:generate
```

This writes a new migration to `drizzle/`. Migrations run at startup before any
data-dependent screen renders; failures surface as a plain-language recovery screen.

- `reading_plan.read_through` (default `1`, `CHECK >= 1`) numbers the time through the
  Bible a segment belongs to. A reading's read-through is its segment's, so there is no
  copy of it on `reading_completion`.
- `reading_completion.is_extra` (default `0`) marks an extra reading. Every row written
  before it existed is a plan reading.

**Check generated SQL for table rebuilds.** SQLite can change some things (adding a
constraint, for one) only by rebuilding the table, and drizzle-kit does that silently.
Migrations run inside a transaction with foreign keys on, where `PRAGMA foreign_keys=OFF`
is ignored, so dropping `reading_plan` would cascade-delete every reading. That is why
the `read_through` CHECK is hand-written inline on the `ADD COLUMN` in
`0002_read_throughs.sql` rather than declared in the schema, and why
`migrations.test.ts` replays that migration inside a transaction with foreign keys on.

`babel-plugin-inline-import` embeds the generated `.sql` files as strings at build time —
without it Metro tries to parse them as JavaScript.

## Testing

Tests are weighted toward domain behaviour rather than snapshots. They live in
`__tests__` folders beside the code they cover, and never inside `src/app`.

Note that React Native Testing Library 14 made `render` **asynchronous** — component
tests must `await renderWithTheme(...)` before querying.
