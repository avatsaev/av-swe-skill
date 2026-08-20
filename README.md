# av-swe

An [Agent Skill](https://agentskills.io) for managing a large-scale software engineering project
as a versioned, ordered, dependency-aware task plan — executed one sprint at a time through a
`backlog -> in_progress -> blocked -> done` state machine, with an auditable trail and `PLAN.md`
as the single source of truth.

It generalizes the clean-room `scope -> plan -> implement` pipeline for **ordinary (non-clean-room)
development**, where the real source code is present and tasks reference it directly instead of
working from specs alone.

## Install

```bash
npx skillpm install av-swe
# or, inside an npm workspace / plain npm project
npm install av-swe
```

`skillpm install` wires the skill into your agent's skill directory automatically. See
[skillpm](https://skillpm.dev) for details.

## What it does

Seven operations, driven from a plan root (default `<project-root>/swe/`):

| Op | Effect |
|----|--------|
| `scope` | Capture requirements and current architecture into spec docs |
| `plan` | Derive an ordered sprint + task plan from specs/source |
| `implement` | Execute one sprint through the state machine, gated on build + test |
| `status` | Report plan health: open/in_progress/blocked/done, next sprint, gaps |
| `validate` | Check plan integrity (ordering, deps, coverage, ids) |
| `block` / `unblock` | Move a task to/from the blocked state |
| `configure` | Inspect or set project conventions |

Only `implement` writes source code — the rest produce or mutate planning artifacts.

## When to use it

Use this skill when you want to plan a large project, feature set, migration, or refactor; break a
large body of work into sprints and small atomic tasks; execute a planned chunk of work with
confidence it actually builds and verifies; or ask "where are we", "what's next", "is the plan
consistent".

See [`skills/av-swe/SKILL.md`](skills/av-swe/SKILL.md) for the full operation index, and
`skills/av-swe/ops/*.md` / `skills/av-swe/conventions/*.md` for the full procedures.

## License

MIT
