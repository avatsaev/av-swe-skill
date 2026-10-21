# Op: `status` — plan health

Read-only report across the whole plan, scanning sprint folders under the configured `sprintsDir`
(default `<plan-root>/sprints/`):
- Each sprint: name, goal, and task counts by state (`backlog` / `in_progress` / `blocked` / `done`).
- The **next sprint to run** (lowest numbered with a non-empty `backlog/`), or "plan complete".
- Any `in_progress/` or `blocked/` tasks and their reasons (open a `## Blocker` / `## Blocked`).
- Outstanding `TODO(verify)` items and coverage gaps vs `PLAN.md`.
- Grill briefs under `<grillsDir>/`: any with `Status: grilling` (unfinished — resume with
  `av-swe grill <name>`) and any `grilled` brief whose *Handoff to scope* spec files do not yet
  exist under `specs/` (grilled but not yet scoped).

Report facts from the folders, not from memory.
