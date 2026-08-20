# Configuration (`swe/av-swe.config.json`)

Seen by all ops. All fields optional.

```jsonc
{
  "planRoot": "swe",                  // plan root relative to project root (default "swe")
  "build": "npm run build",           // shell command run as the build gate
  "typecheck": "npm run typecheck",   // optional typecheck gate
  "lint": "npm run lint",             // optional lint gate
  "test": "npm test",                 // test command run as the test gate
  "skipGates": [],                    // e.g. ["lint"] if a stack has no linter
  "parallelSprints": true,            // allow concurrent execution of independent tasks (see implement)
  "notesDir": "notes"                 // optional; name of the notes/ folder
}
```

If a config file does not exist, ops use the defaults above and do **not** invent gates — they run
whatever build/test commands are standard for the project (e.g. `package.json` scripts) and record
what they ran in the summary. A task's own "Test / verification plan" always wins over config.

## Project-specific escape hatches

Projects that predate `av-swe`, or whose plan root doesn't match the layout in
[layout.md](layout.md), may add extra top-level blocks beyond the core schema above. These are not
part of the schema every project needs, but are an established, non-invented pattern — read the
project's own `av-swe.config.json` for its actual meaning rather than guessing:

- `layout` — overrides for a non-default plan root shape, e.g. `sprintsDir` (if sprints don't live
  directly under the plan root), `specsDirs` (if specs are split across multiple existing
  directories instead of one `specs/`), `specsIndex` (an existing index file standing in for
  `specs/overview.md`), plus a free-form `comment` recording *why* the project deviates and which
  deviations are still open vs. already closed.
- `gateNotes` — preferred scoped/focused commands to run **inside** a task (e.g. a single package's
  build, a focused test run) vs. the full `build`/`test` gates, which still run once at sprint end
  (see [../ops/implement.md](../ops/implement.md)).
