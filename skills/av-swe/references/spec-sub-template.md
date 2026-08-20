# Template: <plan-root>/specs/features/<name>.md  OR  <plan-root>/specs/architecture/<concern>.md

Use for a single user/API-facing **feature** (`features/...`) or a single cross-cutting **architectural
concern** (`architecture/...`). Each sub-spec is self-contained but links its dependencies. Describe
*behavior, contracts, data shapes, algorithms, and intent* — never pasted source bodies (short
signatures/data shapes are fine).

---

```markdown
# <Feature / Concern> — <Name>

> Part of: [overview.md](../overview.md)
> Dependencies: <list of other sub-specs>

## Purpose
(What this feature/concern is and why it exists.)

## Public contract
(APIs, signatures, data shapes, events/hooks, config keys. Use tables for endpoints/params/fields/errors.)

| Endpoint / signature | Inputs | Outputs | Errors |
|----------------------|--------|---------|--------|
| ... | | | |

## Behavior & algorithms
(Pseudocode is encouraged — language-neutral and intent-focused, describing control flow and
transformations, not a transliteration of the code.)

```
function example(input):
    ...
```

## Data & persistence touchpoints
(Entities, fields, storage, migrations relevant to this spec.)

## Error handling & edge cases
| Condition | Expected behavior |
|-----------|-------------------|
| ... | |

## Dependencies on other specs
- `<other spec>` — because ...
- ...

## Acceptance criteria
(Observable and testable; a planner will turn these into task acceptance criteria.)
- [ ] Given ... when ... then ...

## TODO(verify)
- (anything ambiguous that needs confirmation before implementation)
```
