# Op: `plan` — derive the sprint + task plan

Turn specs (and the existing source) into an ordered plan: `swe/PLAN.md` plus task files. **This op
only plans; it never implements.**

## Steps

1. **Read inputs** — `specs/overview.md` fully, every `specs/features/*.md` and
   `specs/architecture/*.md`, plus enough of the existing source to write accurate task
   references. Note each spec's **dependencies** and **acceptance criteria** — they drive ordering.
2. **Derive implementation order** (bottom-up, adapt to the project):
   1. **Foundation** — scaffolding, build tooling, config, base types/schemas, datastore setup.
   2. **Cross-cutting architecture** — persistence, auth, transport/API, shared utilities.
   3. **Features** — in dependency order; foundational features before those that build on them.
   4. **Integration & hardening** — end-to-end wiring, edge cases, observability, docs.
   A task must never depend on something not yet built. When in doubt, schedule the dependency
   earlier.
3. **Group into sprints** — each sprint is a coherent milestone leaving the system **buildable and
   testable**. Keep sprints small (typically **3–8 tasks**); prefer more, smaller sprints. Sprint 001
   should establish the runnable skeleton (build + test harness green with a trivial test) so every
   later task is validatable.
4. **Write tasks** — one `backlog/task-NNN-[name].md` per task using
   [../references/task-template.md](../references/task-template.md). Every task MUST be:
   - **Small & atomic** — one cohesive change, verifiable on its own. If it needs more than a
     handful of steps or touches many concerns, split it.
   - **Testable** — explicit checkable acceptance criteria + a concrete verification plan (commands
     to run, what "pass" looks like).
   - **Reference-linked** — the exact spec sections **and real source files** it touches (relative
     paths).
   - **Self-contained** — restate the needed behavior/contract so the implementer does not re-derive
     it; point to the spec for full detail.
   - **Dependency-aware** — list prerequisites by task id (same or earlier sprint).
5. **Write PLAN.md & verify** — see
   [../references/plan-template.md](../references/plan-template.md). Then verify:
   - every spec (feature + architecture) is covered by at least one task;
   - no task depends on a later task;
   - `backlog/`, `in_progress/`, `blocked/`, `done/` all exist under every sprint folder, each
     containing a `.gitkeep` (so state folders survive git even when legitimately empty — see
     [../conventions/layout.md](../conventions/layout.md));
   - ids are unique and ordered.
   Report to the user: number of sprints, number of tasks, and any scope areas you could not turn
   into tasks (with reasons).

## Updating an existing plan

Add/append work by writing new tasks into the appropriate sprint's `backlog/` (create a new sprint
folder if needed, with `.gitkeep` in all four state folders) and updating `PLAN.md`'s index +
coverage. Never renumber already-`done/` tasks.
