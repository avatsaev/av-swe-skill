# Op: `validate` — plan integrity

Check and report:
- No task depends on a later task (or a task not yet `done/` in its `Depends on` — allowed only if
  that dependency precedes it).
- Unique, ordered, well-formed ids; file location matches its `Status:` field.
- Every spec is covered by ≥ one task; no orphaned tasks (task with no spec or source reference).
- Sprints leave a buildable state (no unfinished dependency mid-sprint that later tasks need).
- Every sprint's `backlog/`, `in_progress/`, `blocked/`, `done/` folder exists and contains a
  `.gitkeep`; recreate any missing folder/`.gitkeep` (trivially fixable, not structural — see
  [../conventions/layout.md](../conventions/layout.md)).

Fix what is trivially fixable (stale `Status:`, missing coverage row); report anything structural.
