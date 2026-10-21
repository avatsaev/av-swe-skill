# Op: `grill` — interrogate a rough idea into a defined feature

Run a structured back-and-forth between the engineer and the agent that turns a **rough feature
idea** into a **grill brief**: a decision log plus a complete-enough feature definition — goals,
non-goals, happy path, data, integration points, edge cases, failure modes, constraints — that
`scope` can turn into a spec without guessing. **This op asks and records; it never writes specs,
plans, or source.**

Use it when the idea is still "we should add X" and the details (what exactly happens, what it
touches, what goes wrong) have not been decided. Skip it when requirements are already written
down — go straight to `scope`.

Produces `<plan-root>/<grillsDir>/<kebab-name>.md` (default `swe/grills/`) using
[../references/grill-brief-template.md](../references/grill-brief-template.md). The brief is the
single artifact: it holds every decision as it lands, so a grill survives a session boundary and a
different agent can resume it.

## Invocation

- `av-swe grill <rough idea>` — start a new grill. Derive `<kebab-name>` from the idea; if a brief
  with that name already exists, resume it instead of starting over.
- `av-swe grill <kebab-name>` — resume an existing brief (`Status: grilling`).

## Discipline

- **Recon before asking.** Read the parts of the real codebase the idea plausibly touches (entry
  points, data model, adjacent features, integrations, config) **before round 1**. Questions must be
  grounded in what exists ("orders are soft-deleted in `orders.deleted_at` — does X apply to
  deleted orders?"), not generic. Do not transcribe source into the brief; reference paths.
- **The agent brings the edge cases.** Never ask "any edge cases?". Propose concrete ones derived
  from recon and the checklist below, each phrased as a decision to make.
- **One theme per round, 3–5 questions per round.** Each question states the agent's
  **recommendation** and the tradeoff, and offers 2–4 concrete options where options exist. If the
  agent's tool-set has a structured multi-choice question tool, use it; otherwise ask in plain chat
  with lettered options.
- **Record after every round, before asking the next.** Append decisions to the brief immediately
  (decision table, edge-case table, round log, `Last updated`). Never hold answers in memory only.
- **Never invent answers.** An unanswered or "don't know" question becomes a `TODO(verify)` with an
  owner, not a silent default. "Skip / later" becomes a **Deferred** entry with what was deferred.
- **Challenge, don't rubber-stamp.** When an answer contradicts an earlier decision, the codebase,
  or a non-functional constraint, say so with the evidence and ask which one wins. Record the
  resolution and the rationale.
- **Stop at convergence, not at a round count.** Exit when the exit criteria below hold. Do not
  pad with questions whose answer would not change the spec.
- **Stay upstream.** No API signatures beyond what pins a public contract, no file-level task
  breakdown, no sprint thinking. That is `scope` and `plan`.

## Themes (default round order)

Run each theme as one round (merge or skip a theme only when recon or earlier answers already
settle it — note that in the round log). Adapt the order when a later theme obviously drives the
earlier ones.

1. **Problem & outcome** — who has the problem, what they do today, what "done" looks like for
   them, what success is measured by.
2. **Scope boundary** — what is in, what is explicitly out, what the smallest shippable version
   is, what is deliberately deferred.
3. **Happy path** — the main scenario step by step from trigger to observable result; actors;
   what the user sees/receives at each step.
4. **Data & state** — new/changed entities and fields, ownership, lifecycle, derived vs stored,
   migration of existing data, retention.
5. **Integration points** — every existing module, API, job, event, external service, config key
   and permission the feature touches; direction of each dependency; who else consumes what the
   feature changes.
6. **Edge cases & failure modes** — walk the checklist below against recon findings; each item is
   either a decision, a `TODO(verify)`, or an explicit "not applicable because …".
7. **Non-functional constraints** — performance/volume, security & authorization, privacy,
   backward compatibility, rollout/feature flag, observability, rollback.
8. **Acceptance** — the handful of observable, testable statements that would prove the feature
   works; confirm they cover every decision marked as must-have.

### Edge-case checklist

Walk every row; silence on a row is not a decision.

| Area | Prompts |
|------|---------|
| Inputs | empty / null / missing fields; maximum sizes; malformed or unexpected encodings; duplicates |
| Identity & access | unauthenticated; wrong role/tenant; acting on another user's data; revoked mid-flow |
| State | already exists; already deleted / soft-deleted; stale version; concurrent edit of the same record |
| Timing | retries & idempotency; partial failure mid-sequence; timeouts; out-of-order events; time zones / DST |
| Scale | one vs. thousands; pagination; hot keys; batch vs. single; rate limits of dependencies |
| Dependencies | external service down / slow / returns errors; schema or contract drift; version skew during rollout |
| Data lifecycle | existing records predating the feature; migration & backfill; deletion & retention; export |
| Observability & ops | what is logged/metered; alerting; feature flag off; rollback with data already written |

## Steps

1. **Open or resume the brief.** New: create
   `<plan-root>/<grillsDir>/<kebab-name>.md` from the template with `Status: grilling`, the
   raw idea verbatim under *Raw idea*, and the start date. Resume: read the whole brief, restate
   the current state (decisions so far, open questions, next theme) to the engineer in a few lines,
   and continue from the next theme in the round log.
2. **Recon.** Read the relevant source (see Discipline). Fill *Codebase context* in the brief with
   the touched areas as path references plus one-line facts that will drive questions.
3. **Grill rounds.** For each theme: ask the round (3–5 questions, each with recommendation +
   options), wait for answers, then **immediately** record: decisions into *Decisions*, edge cases
   into *Edge cases & failure modes*, integrations into *Integration points*, deferrals into
   *Deferred*, unknowns into *Open questions*, and one line into *Round log*. Bump `Last updated`.
   Raise contradictions as they appear.
4. **Converge.** When the exit criteria hold, set `Status: grilled`, write the *Handoff to scope*
   section (which sub-spec files `scope` should produce and which brief sections feed each), and
   give the engineer a short readout: number of rounds, count of decisions / edge cases / open
   questions, and the deferred list.
5. **Hand off.** Tell the engineer the next step is `av-swe scope`, which reads grilled briefs as
   primary input (see [scope.md](scope.md)). Do not run it unasked.

## Exit criteria (all must hold)

- *Goals*, *Non-goals*, *Happy path*, *Data & state*, *Integration points*, and *Acceptance
  criteria* are filled — none still carries template placeholder text.
- Every edge-case checklist area has at least one row in *Edge cases & failure modes* or an
  explicit "n/a — reason" line.
- No open question is a **blocker** (one whose answer would change the happy path, the data model,
  or an integration contract). Non-blocking unknowns may remain as `TODO(verify)` with an owner.
- The engineer has confirmed the readout. A grill is never closed unilaterally by the agent.

## Hard rules

1. **Grill writes only the brief.** No `specs/`, no `PLAN.md`, no sprints, no source.
2. **Every answer lands in the brief in the same round it is given.**
3. **No fabricated decisions.** Unknown → `TODO(verify)` with owner; skipped → *Deferred*.
4. **Recon is mandatory before the first question** when a codebase exists.
5. **A brief with `Status: grilled` is input to `scope`; one with `Status: grilling` is not.**
   `scope` must not consume an unfinished grill.
