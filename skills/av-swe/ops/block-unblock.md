# Op: `block` / `unblock`

- `block <sprint>/<task> <reason>` — move the task to `blocked/`, set `Status: blocked`, append a
  `## Blocked` section with the reason and what unblocking depends on. (A task already `in_progress`
  with a `## Blocker` from a failed build is not the same as a `blocked` task — keep those distinct.)
- `unblock <sprint>/<task>` — move it back to `backlog/` (or `in_progress/` if its work is
  committed and it resumes immediately) and clear the blocked section.
