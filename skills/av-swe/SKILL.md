---
name: av-swe
description: "Manage a large-scale software engineering project as a versioned, ordered, dependency-aware task plan, executed one sprint at a time through a backlog -> in_progress -> done state machine, with an auditable trail and PLAN.md as the single source of truth. Generalizes the clean-room scope -> plan -> implement pipeline for ordinary (non-clean-room) development: the real source is present and tasks reference it, not just specs. Ops: scope (capture what to build into swe/specs/), plan (derive sprints+tasks), implement (execute one sprint with a hard build+test definition of done), status/validate (plan health), block/unblock, configure. Use when the user wants to plan a large project, break requirements into sprints/tasks, run a sprint, or inspect plan progress."
---

# AV-SWE — plan-driven software engineering at scale

Turn a large software engineering effort into a **small, ordered, dependency-aware, verifiable task
plan**, and execute it reliably. Built by generalizing the clean-room
`scope → plan → implement` skills for ordinary development where the **real source code is present**
(no clean-room blinders), plus explicit long-lived project-management operations for driving a big
project over many sessions.

The whole system lives under a **plan root** (default `<project-root>/swe/`) and is driven by seven
operations (`block`/`unblock` are two directions of one mechanism). Nothing here is a rigid process
for its own sake — the point is that a big project stays **plannable, trackable, and consistently
deliverable** without the plan rotting.

This file is deliberately a thin index. Each op's full procedure lives in its own file under `ops/`;
shared conventions (layout, naming, state machine, config schema) live under `conventions/`. Read the
linked file for the op you're about to run — do not rely on this page alone.

## When to use

- The user wants to plan a large project, feature set, migration, or refactor.
- The user wants to break a large body of work into sprints and small atomic tasks.
- The user wants to execute a planned chunk of work with confidence it actually builds and verifies.
- The user asks "where are we", "what's next", "is the plan consistent", or wants to move tasks
  between states.

## Operations at a glance

| Op | Effect | Produces / mutates | Full procedure |
|----|--------|--------------------|-----------------|
| `av-swe scope` | Capture requirements and current architecture into spec docs | `swe/specs/*.md` | [ops/scope.md](ops/scope.md) |
| `av-swe plan` | Derive an ordered sprint + task plan from specs/source | `swe/PLAN.md`, `swe/sprint-NNN-*/` | [ops/plan.md](ops/plan.md) |
| `av-swe implement` | Execute one sprint through the state machine, gated on build+test | task moves + `*-summary.md` | [ops/implement.md](ops/implement.md) |
| `av-swe status` | Report plan health: open/in_progress/blocked/done, next sprint, gaps | read-only report | [ops/status.md](ops/status.md) |
| `av-swe validate` | Check plan integrity (ordering, deps, coverage, ids) | read-only report | [ops/validate.md](ops/validate.md) |
| `av-swe block` / `unblock` | Move a task to/from the blocked state | task file moves | [ops/block-unblock.md](ops/block-unblock.md) |
| `av-swe configure` | Inspect or set project conventions | `swe/av-swe.config.json` | [ops/configure.md](ops/configure.md) |

Only `implement` writes source code. The others produce or mutate planning artifacts.

---

## Plan root & layout

Everything is rooted at the **plan root** (default `<project-root>/swe/`; override via
`configure`): `PLAN.md` at the root, `specs/` + `notes/` as inputs, and one
`sprint-NNN-[kebab-name]/` per sprint holding `backlog/`, `in_progress/`, `blocked/`, `done/` task
folders. All four state folders always exist (each holds a `.gitkeep`, even when empty), and a
task's physical folder — never its `Status:` field alone — is the source of truth for its state.

Full directory tree, naming rules, the task state machine, and the `.gitkeep` convention:
[conventions/layout.md](conventions/layout.md).

## Configuration

All ops read `swe/av-swe.config.json` (optional; every field defaults sanely, and a missing file
means "use the project's standard build/test commands," never an invented gate).

Schema, defaults, and project-specific escape hatches: [conventions/config.md](conventions/config.md).

---

## Hard rules

1. **Task files describe what to build + how to verify — never full implementations.** Short
   signatures/data shapes are fine; source bodies belong in `implement`, not in task files.
2. **Never mark a task done with a failing build or failing tests.**
3. **One task at a time by default** (parallel mode is an explicit, guarded exception); always
   reflect status by physically moving the file between folders.
4. **Numeric order = execution order**, both for sprints and tasks within a sprint. Never renumber
   completed tasks.
5. **Respect task order and dependencies.** A later task must never depend on something unbuilt.
6. **Implement only the task in hand.** Do not advance the plan during an `implement` run beyond the
   current sprint.
7. **Keep `PLAN.md` in sync** whenever sprints/tasks change — it is the single source of truth a
   `status`/`validate`/next-sprint answer is read from.
8. **Every sprint's four state folders always exist, each with a `.gitkeep`.** Create all four with
   their `.gitkeep` the moment a sprint folder is created; never delete a `.gitkeep`, even once the
   folder holds real files — a folder emptied by moving its last task out (e.g. `backlog/` at the
   end of a sprint) must still exist afterward.

## Reference templates

- [references/task-template.md](references/task-template.md) — the task file contract.
- [references/plan-template.md](references/plan-template.md) — PLAN.md (strategy, indexes, coverage).
- [references/summary-template.md](references/summary-template.md) — the per-task audit trail.
- [references/spec-overview-template.md](references/spec-overview-template.md) — whole-effort spec.
- [references/spec-sub-template.md](references/spec-sub-template.md) — feature/architecture spec.

## Bootstrap checklist (first use on a project)

1. `av-swe configure` — optional; set test/build gates if the default guesses are wrong.
2. `av-swe scope` — unless requirements are already written down.
3. `av-swe plan` — derive `swe/PLAN.md` + `sprint-001/…` task files.
4. `av-swe implement` — run sprints in order.
5. `av-swe status` — at any point to see where the project stands.
