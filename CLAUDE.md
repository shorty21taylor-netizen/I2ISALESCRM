# Summit OS — working notes for agents

A multi-tenant sales CRM. Each workspace is a different company's books. Most of the
rules below exist because a specific bug got into production, not because they sound
prudent.

## The one that matters: workspace isolation

Six cross-workspace leaks have been found and closed in this codebase. Every one had
the same shape: **a missing workspace defaulted to "everything" or to `'default'`
rather than to "wherever the caller is."**

So, without exception:

- **The server decides the workspace. Never the client, never the payload.**
  Reads go through `effectiveReadWorkspace(req, requested)`, writes through
  `effectiveWriteWorkspace(req, requested)` (`src/lib/access.js`). A member's session
  is pinned to one workspace; a query string asking for another is ignored, not obeyed.
- **A missing workspace means "the one they are standing in", never `'default'`
  and never "all of them".** An operator working inside a new client who files a deal
  must not have it land in the original company's books.
- **Fail closed.** Where a destination or a workspace cannot be resolved, refuse the
  write. A record nobody was told about — or that the wrong company was told about —
  is worse than a submission that failed loudly.
- When you add a route that reads records, scope it and then **probe it as another
  workspace's manager** before calling it done. Three of the six leaks were found
  that way, not by reading the code.

## Form ingest: the key decides the workspace

`/api/forms/ingest` is public and authenticated by an ingest key.

- Each workspace has **its own key** (`workspace_integrations`, provider `summit`,
  key `ingest_key`). A workspace holding one is **sealed**: that key writes there and
  nowhere else, and no other key writes into it.
- `createWorkspace()` seals a new workspace on the way in, before it can receive
  anything. **Do not remove that.**
- The payload's `workspaceId` is not trusted. A per-workspace key overrides it
  entirely; the shared install-wide key is refused on an unknown workspace and on any
  sealed one.
- The shared `FORM_INGEST_KEY` exists only for workspaces not yet migrated. It stops
  working on its own once every workspace is sealed.

**When helping someone set up a new workspace or new forms, follow
`docs/SOP-NEW-WORKSPACE.md` and make sure the workspace has its own key before any
form is pointed at it.** Never tell anyone to put `workspaceId` in an n8n body, and
never reuse one workspace's key on another workspace's form — the form will look
like it is working while filing into the wrong company.

## Style

The code is deliberately ES5-flavoured: `var`, `function () {}`, string
concatenation. No `const`/`let`, no arrow functions, no TypeScript. Match the file
you are editing rather than modernising it.

Comments explain **why**, especially where the obvious implementation was wrong.
Keep them when refactoring; they are the record of what already broke.

## Architecture

- Next.js 15 App Router. Dashboard pages live in `src/app/(dashboard)`.
  API routes carry `export var dynamic = 'force-dynamic'`.
- An in-memory store (`src/lib/store.js`) mirrored to Postgres (`src/lib/db.js`).
  **`db.js` is the only SQL surface.**
- Every record table is `(id TEXT PRIMARY KEY, data JSONB, workspace_id TEXT,
  created_at, deleted_at)` — **not** normalized columns. A column is only promoted
  out of the JSONB when it needs an index (`pipeline_records.ghl_appointment_id`).
- **There is no `migrations/` directory.** Schema is created idempotently in
  `db.js initDatabase()` with `CREATE TABLE IF NOT EXISTS`. A `.sql` file added to
  the repo is a file nothing ever runs.
- `workspaces.id` is **TEXT** (`'default'`, `'ws-…'`), never a serial integer.
  Reps are keyed by **name and email**, never an integer id. Record ids are TEXT
  (`'book-1789…-a3f2'`).
- Schema changes are **additive only**. No drops, no renames. Deprecate by disuse.
  Deletes are soft, via `deleted_at`.
- Days are bucketed in the team's timezone (`src/lib/report-date.js`,
  `America/Los_Angeles`), never the server's. A 9pm PT deal belongs to that day.

## Do not modify

`addBookedCall`, `addClosedDeal`, `addEODReport`, `recalcOverview`, `registerCloser`.
Everything the floor's numbers rest on flows through them. Call them and act on what
they return; never change them to suit a new feature.

## Ownership of a record

**A named record belongs to the person named. The email only decides when there is no
name.** A manager filing on a rep's behalf produces a record carrying the manager's
email and the rep's name; matching on either would hand it to both of them and count
every figure twice. `repIdentity()` in `src/lib/rep-stats.js` is the one
implementation — use it, do not write another.

Note a real gap: a rep added through Team & Permissions gets a `workspace_users` row
but not always an `app_users` row. `pipelineViewer()` falls back to the roster name;
`src/lib/rep-scope.js` does not yet, so those reps can see an empty Booked Calls or
My Dashboard.

## Dashboard figures

Anything shown under a date filter must be **computed over that range**. The setter
board was once handed the whole store with no filter, so "Sets closed" and "Cash from
sets" were all-time numbers sitting under a header that said Today.

Counts that can come from two sources take the **higher of the two, never the sum** —
a rep who files an EOD *and* submits the forms would otherwise be counted twice. See
`bookedOn()` and `cashOn()` in `src/lib/sales-report.js`.

## Verifying work

There is no test framework. Verification is a script against a running server:

```bash
ps -eo pid,cmd | grep "[n]ext-server" | awk '{print $1}' | xargs -r kill -9
TEAM_PASSWORD='...' FORM_INGEST_KEY=... setsid nohup npm run start > /tmp/srv.log 2>&1 &
```

Never use `pkill` to stop it — the pattern matches the agent's own shell and kills
the session.

This container has **no database**; the store is in memory and empties on restart.
Seed what a test needs inside the test, and do not assume a clean store between
suites.

For UI work, compare element geometry before and after rather than eyeballing
screenshots. A desktop regression of 268px was invisible in a pixel diff and obvious
in a bounding-box diff.
