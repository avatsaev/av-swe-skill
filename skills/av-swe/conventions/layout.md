# Plan root & layout

Everything is rooted at the **plan root**. Default `<project-root>/swe/`; override via
`av-swe configure` (stored in `swe/av-swe.config.json`).

```
<project-root>/swe/
├── PLAN.md                        # single source of truth: strategy + sprint/task index + coverage + open questions
├── av-swe.config.json             # optional project conventions (planRoot, build/test/lint gates, notes dir)
├── specs/                         # what & how — produced by `scope` or written by hand
│   ├── overview.md                # whole-project / whole-effort spec + index of sub-specs
│   ├── features/<name>.md         # one per user/API-facing capability
│   └── architecture/<concern>.md  # one per cross-cutting concern (persistence, auth, transport, …)
├── notes/                         # optional: design decisions / ADRs, meeting notes, research
└── sprint-NNN-[kebab-name]/
    ├── backlog/     task-NNN-[name].md   # not started
    ├── in_progress/                      # currently being implemented (at most a few)
    ├── blocked/                           # waiting on something; kept for visibility
    └── done/       task-NNN + task-NNN-[name]-summary.md
```

Each of `backlog/`, `in_progress/`, `blocked/`, `done/` contains a `.gitkeep` file, created with the
sprint and **never removed**, even once the folder holds real task files — this is what keeps all
four state folders present (and diffable) in git through every point in the state machine, including
the moments a folder is legitimately empty (a fresh sprint's `in_progress/`/`blocked/`/`done/`, or a
finished sprint's `backlog/`). Git does not track empty directories; without a placeholder a state
folder silently vanishes and reappears only when something is moved into it.

`PLAN.md`, the sprint folders, and the task files **are the plan**. `specs/` and `notes/` are inputs
the plan derives from; treat them as consultable but keep task files as the executable unit.

## Naming rules (the plan database schema)

- Sprint folders: `sprint-NNN-[short-kebab-name]`, zero-padded to 3 digits, numbered in
  **implementation order** (sprint-001 is built first).
- Task files: `task-NNN-[short-kebab-name].md`, zero-padded to 3 digits. **Numbering restarts at
  001 within each sprint**; numeric order = execution order within the sprint.
- States are **mirrored by the physical folder the file lives in** — never trust the `Status:` field
  alone; it must match the file's location.

## Task state machine

```
backlog ──claim──▶ in_progress ──done──▶ done
   ▲                    │
   │   unblock          │ block
   └─────── blocked ◀───┘
```

- `backlog` → `in_progress`: on claim (only when `Depends on` are already `done`).
- `in_progress` → `done`: only when the **definition of done** passes (see
  [../ops/implement.md](../ops/implement.md)).
- `in_progress` → `blocked`: task is stuck on external input (unavailable dependency, missing
  credentials, a decision). Record the reason in the task file.
- `blocked` → `backlog`: once unblocked and ready to claim again.
