# Op: `status` — plan health

Read-only report across the whole plan:
- Each sprint: name, goal, and task counts by state (`backlog` / `in_progress` / `blocked` / `done`).
- The **next sprint to run** (lowest numbered with a non-empty `backlog/`), or "plan complete".
- Any `in_progress/` or `blocked/` tasks and their reasons (open a `## Blocker` / `## Blocked`).
- Outstanding `TODO(verify)` items and coverage gaps vs `PLAN.md`.

Report facts from the folders, not from memory.
