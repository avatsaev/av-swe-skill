# Template: backlog/task-NNN-[short-name].md

Copy this into each task file. Tasks must be small, atomic, and testable. Reference the relevant
`swe/specs/` documents **and the real source files** they touch. Do not paste full source code —
short signatures/data shapes are fine to pin a contract.

---

```markdown
# Task NNN — <Short Title>

- **Sprint:** sprint-NNN-<sprint-name>
- **Status:** backlog            # backlog | in_progress | blocked | done — MUST match the folder the file is in
- **Type:** feature | bugfix | refactor | chore | test | docs
- **Area:** <module / domain / subsystem>
- **Priority:** P1 | P2 | P3
- **Estimated size:** XS | S | M    # prefer XS/S; split anything larger
- **Depends on:** task-### (same or earlier sprint), or "none"

## Goal
(One or two sentences: the single outcome this task delivers.)

## Context / why
(Behavior to deliver. For a bugfix, the repro and expected behavior. For a refactor, the goal and
the invariant to preserve. Why it matters, briefly.)

## Scope references
(Exact spec sections AND real source files this task implements. Relative to the project root.)
- `swe/specs/overview.md` § <section>
- `swe/specs/features/<file>.md` § <section>
- `swe/specs/architecture/<file>.md` § <section>
- `src/...` (files to create or modify)

## What to build
(Describe the change behaviorally. List files/modules to create or modify and the contracts to
satisfy. Short signatures/data shapes where they clarify the contract — no full implementations.)

- Create/modify: `src/...`
- Public contract: (names, inputs, outputs, errors, side effects)

## Out of scope
(What this task explicitly does NOT cover — pushed to later tasks.)

## Acceptance criteria
(Observable, checkable. The implementer cannot mark the task done until all pass.)
- [ ] Given ... when ... then ...

## Test / verification plan
(Concrete steps the implementer runs to prove it works. Name the commands — these gate "done".)
- Build: `<command>` succeeds.
- Typecheck/Lint (if applicable): `<command>` succeeds.
- Tests: add/extend tests at `<path>`; run `<test command>`; all pass.
- Manual check (if needed): `<steps and expected result>`.

## Notes
(Edge cases, gotchas, or TODO(verify) items inherited from the spec or found during planning.)
```
