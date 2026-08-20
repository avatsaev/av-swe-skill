# Template: <plan-root>/PLAN.md

Ordered overview and index of the whole implementation plan. **Single source of truth** — update it
whenever sprints/tasks change. `status` and `validate` are read from (and against) this file.

---

```markdown
# Implementation Plan — <Project / Effort>

> Derived from the specs in `<plan-root>/specs/` and the existing source. Sprints and tasks are in
> implementation order. Execute with `av-swe implement`, one sprint at a time.
> **Version:** <v> · **Updated:** <date>

## Strategy
(Bottom-up ordering narrative: foundation → cross-cutting architecture → features → integration &
hardening; note why this order.)

## Sprint overview
| # | Sprint | Goal | Tasks |
|---|--------|------|-------|
| 001 | `sprint-001-<name>` | (milestone outcome) | N |
| 002 | `sprint-002-<name>` | | |

## Task index
### sprint-001-<name>
| Task | Title | Type | Area | Depends on | Covers (specs + source) |
|------|-------|------|------|-----------|------------------------|
| task-001 | | | | none | specs/features/...md · src/... |
| task-002 | | | | task-001 | specs/architecture/...md |

### sprint-002-<name>
| Task | Title | Type | Area | Depends on | Covers (specs + source) |
|------|-------|------|------|-----------|------------------------|
| ... | | | | | |

## Coverage check
(Confirm every spec — and every major module of the source being changed — is covered by at least
one task. List gaps.)

| Spec / module | Covered by |
|---------------|-----------|
| specs/features/<file>.md | task-... |
| specs/architecture/<file>.md | task-... |

## Open questions — TODO(verify)
- [ ] (anything that needs clarification before/while implementing)
```
