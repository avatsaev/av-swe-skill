# Template: <plan-root>/sprint-NNN-<name>/done/task-NNN-[short-name]-summary.md

Written when a task is completed and moved to `done/`. Records proof that the task works. The
"Build & test results" section is the audit trail — paste the actual commands and outputs.

---

```markdown
# Task NNN — <Title> — Summary

- **Sprint:** sprint-NNN-<name>
- **Completed:** <date/time>
- **Status:** done

## What was implemented
(Concise description of the change and the behavior delivered.)

## Files created / changed
| File | Change |
|------|--------|
| `src/...` | created |
| `src/...` | modified |
| `tests/...` | added tests |

## How it satisfies the scope
(Map the implementation back to the referenced `swe/specs/` sections and source contracts. Note any
deviations and why.)

## Build & test results
```
$ <build command>
<result: success>

$ <typecheck/lint command>          # if applicable
<result: success>

$ <test command>
<result: N passed, 0 failed>
```

## Acceptance criteria
- [x] Given ... when ... then ...   (verified by <test/step>)
- [x] ...

## Follow-ups / TODO(verify)
- (anything deferred, assumptions made, or items needing later confirmation)
```
