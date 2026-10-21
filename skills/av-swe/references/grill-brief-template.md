# Template: <plan-root>/<grillsDir>/<kebab-name>.md

The single artifact of `av-swe grill` (see [../ops/grill.md](../ops/grill.md)): a decision log
plus the resulting feature definition. It is written **incrementally, after every round**, so it is
always a faithful snapshot of what has been decided and what is still open. It describes *intent,
behavior, boundaries, and decisions* — never source bodies; reference paths instead.

`Status` is `grilling` until the exit criteria hold and the engineer confirms, then `grilled`. Only
a `grilled` brief is input to `scope`.

---

```markdown
# Grill — <Feature name>

> Status: grilling | grilled
> Started: YYYY-MM-DD   Last updated: YYYY-MM-DD   Rounds: N
> Engineer: <name/handle>   Agent: <agent/model>

## Raw idea
(The engineer's original wording, verbatim. Never edited afterwards.)

## Codebase context
(Filled during recon, before round 1. Path references + one-line facts that drive questions.)
| Area | Path(s) | Fact that matters |
|------|---------|-------------------|
| ... | `src/...` | ... |

## Problem & outcome
- **Who:** ...
- **Today:** ...
- **Done means:** ...
- **Measured by:** ...

## Goals
- ...

## Non-goals
- ...

## Happy path
1. <trigger> — actor, what they do
2. ...
N. <observable result>

## Decisions
| # | Theme | Question | Decision | Rationale | Round |
|---|-------|----------|----------|-----------|-------|
| D1 | scope | ... | ... | ... | 2 |

## Data & state
(New/changed entities and fields, ownership, lifecycle, derived vs stored, migration of existing
data, retention. Shapes as short snippets only when they pin a contract.)

## Integration points
| Existing module / service / config | How the feature touches it | Direction | Risk / note |
|------------------------------------|----------------------------|-----------|-------------|
| `src/...` | ... | reads / writes / emits / consumes | ... |

## Edge cases & failure modes
(One row per decided case; every checklist area appears at least once, or as "n/a — reason".)
| Area | Condition | Decided behavior | Decision |
|------|-----------|------------------|----------|
| inputs | ... | ... | D7 |
| timing | n/a — ... | | |

## Non-functional constraints
| Concern | Constraint / decision |
|---------|-----------------------|
| Performance / volume | |
| Security & authorization | |
| Privacy | |
| Backward compatibility | |
| Rollout / feature flag | |
| Observability | |
| Rollback | |

## Deferred
(Explicitly postponed, with what exactly was deferred and why — never silently dropped.)
- ...

## Open questions — TODO(verify)
(Blocking questions prevent `Status: grilled`. Each has an owner.)
- [ ] (blocking) ... — owner: ...
- [ ] ... — owner: ...

## Acceptance criteria (draft)
(Observable and testable; `scope` carries these into the sub-spec, `plan` into tasks.)
- [ ] Given ... when ... then ...

## Round log
| Round | Theme | Summary |
|-------|-------|---------|
| 1 | problem & outcome | ... |

## Handoff to scope
(Written at `grilled`. Which sub-spec files `scope` should produce and which brief sections feed
each.)
| Spec file to produce | Fed by brief sections |
|----------------------|-----------------------|
| `specs/features/<name>.md` | Goals, Happy path, Decisions, Edge cases, Acceptance criteria |
| `specs/architecture/<concern>.md` | Integration points, Data & state, Non-functional constraints |
```
