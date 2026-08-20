# Op: `scope` — capture what to build

Produce spec documents under `swe/specs/`. Use this when the effort needs its requirements and
architecture written down **before** planning. Works whether you are documenting:

- an **existing** codebase (to plan changes/refactors around it), or
- a **greenfield** effort (turn requirements/ideas into a buildable spec).

## Discipline

Describe **behavior, contracts, data shapes, algorithms, and intent** — not pasted source. Notes:
- **Pseudocode is encouraged** for algorithms/control flow; keep it language-neutral and intent-focused.
- Describe **contracts, not implementations**: inputs, outputs, side effects, error modes, invariants, state transitions, edge cases.
- **Public names are facts** (API paths, env vars, config keys, table/column names) and belong in the spec.
- **Never guess.** If something is unclear, mark `> TODO(verify): …` rather than inventing.
- Short signature/data-shape snippets are fine when they define a contract; full bodies are not.

## Steps

1. **Recon** — read manifests, entry points, run scripts, directory map, dependencies, data model,
   and enumerate the main features and architectural concerns. Read enough to understand; do not
   transcribe.
2. **Write `overview.md`** (see
   [../references/spec-overview-template.md](../references/spec-overview-template.md)) — purpose, tech
   stack, high-level architecture (ASCII diagram), module/directory map, data model overview,
   integrations & config, build/run/test/deploy, and an **index of every sub-spec** with one-line
   descriptions.
3. **Write sub-specs** (see
   [../references/spec-sub-template.md](../references/spec-sub-template.md)) —
   `features/<name>.md` and `architecture/<concern>.md`. Each: purpose, public contract,
   behavior/algorithms (pseudocode), data/persistence touchpoints, error handling, edge cases,
   dependencies on other specs, and **acceptance criteria** a later task can test against.
4. **Cross-link & verify** — the overview index must list every file actually created; add
   cross-references; re-scan to strip any verbatim source; list outstanding `TODO(verify)` items in
   `overview.md`.
