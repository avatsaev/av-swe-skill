# Template: <plan-root>/specs/overview.md

The top-level document describing the **entire effort or existing system**. It must describe
*behavior, contracts, data shapes, and intent* — never pasted source bodies (short signature/data
shape snippets are fine to pin a contract). Keep an index of every sub-spec so nothing is orphaned.

---

```markdown
# <Project / Effort> — Overview

> Source of truth for what this effort is and how it fits together. Sub-specs describe the details;
> this file ties them together and indexes them.

## Purpose & scope
(What the system/effort is, what it is not.)

## Tech stack & runtime requirements
| Concern | Choice |
|---------|--------|
| Language | |
| Run/business logic layers | |
| Framework / build | |
| Persistence | |
| Key external integrations | |

## High-level architecture
(ASCII diagram of components and how they interact.)

```
┌───────┐   ┌───────┐
│ A     │──▶│ B     │
└───────┘   └───────┘
```

## Module / directory map
| Path | Responsibility |
|------|----------------|
| `src/...` | |

## Data model overview
(Entities, relationships, key fields — a summary; full shapes live in the relevant sub-specs.)

## External integrations & configuration
(Env vars, config keys, services, secrets. Public names are facts and belong here.)

## Build / run / test / deploy overview
(Build, run, test, and deploy commands and expectations.)

## Sub-spec index
| File | Kind | Description |
|------|------|-------------|
| [features/<name>.md](features/<name>.md) | feature | ... |
| [architecture/<concern>.md](architecture/<concern>.md) | architecture | ... |

## Open questions — TODO(verify)
- [ ] (anything unresolved; kept here so it is easy to find and resolve)
```
