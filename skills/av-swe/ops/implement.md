# Op: `implement` — execute one sprint

Execute **one** sprint through the state machine. **Input:** a sprint (folder name or number). If
none given, pick the **lowest-numbered sprint that still has `backlog/` tasks**; if none has backlog
tasks, the plan is complete — report that and stop.

For each task in numeric order:

## 1. Claim

- Pick the lowest-numbered `task-NNN-*` in `backlog/`.
- Confirm its `Depends on` tasks are already in `done/`. If a dependency is unmet, **stop and
  report** (the plan is mis-ordered); do not skip ahead.
- `mv` `backlog/ → in_progress/`; set `Status: in_progress`.

## 2. Understand

- Read the task fully, then every spec section and source file it references (contracts, data
  shapes, algorithm pseudocode, error modes, acceptance criteria).

## 3. Implement

- Change the real source at `<project-root>`, **scoped to this task only**. Do not implement future
  tasks. Follow the project's existing conventions and the repo's doc-sync rules.

## 4. Build & test (definition of done)

A task is **done only when**:
- [ ] The project **builds** (config `build`, or the standard build for the project).
- [ ] **Typecheck / lint** gates pass where configured and applicable.
- [ ] Automated **tests pass**, covering the acceptance criteria (add/extend tests as needed; set up
      a harness in an early task if none exists).
- [ ] Every **acceptance-criteria checkbox** is satisfied.

Run the actual commands. Record them and their results — they go in the summary. **Never mark a
task done with a failing build or failing tests.**

If it cannot go green after reasonable effort:
- Leave the task in `in_progress/`.
- Append a `## Blocker` section describing what failed and why.
- **Stop the loop and report**; do not proceed to later tasks (they may depend on this one).

## 5. Complete

- Write `done/task-NNN-[name]-summary.md` per
  [../references/summary-template.md](../references/summary-template.md): what was built, files changed,
  commands run + results, acceptance-criteria status, follow-ups/`TODO(verify)`.
- `mv` `in_progress/ → done/`; set `Status: done`.
- Continue to the next backlog task.

## Optional parallel execution

When `parallelSprints` is true **and** two or more backlog tasks have **no `Depends on` relation to
each other**, you MAY execute them concurrently by delegating to subagents — each subagent still
must pass the per-task definition of done and write its own summary before the task is moved to
`done/`. Never run tasks concurrently if one depends on the other. Keep the fan-out modest and
coordinate shared-file edits to avoid conflicts.

## End of sprint

When `backlog/` is empty: run the **full build + test suite once more** to confirm the sprint is
green, then report: tasks completed, total tests added/passing, build status, open
`TODO(verify)`/blockers, and which sprint is next per `PLAN.md`.
