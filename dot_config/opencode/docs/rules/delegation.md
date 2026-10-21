# Delegation

The routing tables live in the orchestrator prompt (`oh-my-opencode-slim.jsonc`,
`orchestratorPrompt` per agent). That prompt is authoritative for *which*
specialist. This file carries the judgment those tables assume.

## Weigh cost, not habit

- **Delegate** when the work is deep, multi-step, or high-stakes, a suitable
  specialist exists, and the overhead pays for itself: dispatch prompt,
  background bookkeeping, session setup, context hand-off.
- **Do it yourself** when the work is single-step, low-risk, and mostly already
  in your context. Explaining it costs more than doing it. Re-reading files just
  to restate context for a specialist is the tell.
- Neither pole is a virtue. A delegate that starts cold re-learns what you
  already know. A 40-file sweep run alone is not diligence.

## Lanes

Create every code-editing lane with the cow worktree plugin (`spawn_workspace`),
never `git worktree add`. Plugin lanes get inventory (`list_worktrees`), attach
and refuse protection, and cross-session visibility; bare worktrees are invisible
to every other session and race-prone. On spawn failure, recover through
`list_worktrees`. Leave commit or stage breadcrumbs in a lane before handoff, so
the next session grounds on disk instead of the registry.

## Which specialist

- **@poteto-agent** — bounded implementation with a named playbook: a bug fix
  with root-cause evidence, a feature with a named data shape, a
  behavior-preserving refactor, a metric hillclimb. It carries the methodology:
  reproduce first, verify against the real artifact. Give it file pointers and
  scope, not inlined context.
- **@fixer** — purely mechanical edits under a precise instruction: apply this
  diff, rename across files, a bounded follow-up that preserves the existing
  design. Parallel instances per folder only when the folders are truly
  independent.
- **@fast-generic** — mechanical command work: git recon, commit preparation,
  pushes, lint, typecheck, tests, builds, package-manager equivalents. Not for
  code edits, design, architecture, debugging strategy, or destructive git
  history.
- **@investigator** — evidence: root-cause archaeology, transcript or git
  mining, citation checks, multi-source synthesis. Read-only.
- **@explorer** — discovery: one file, one symbol, external docs and web
  research. Use it when you lack the path; the cost is the search, not the
  reasoning.
- **@designer** — anything a user sees: layout, hierarchy, spacing, motion,
  responsive behaviour. Never do design work yourself.
- **@oracle** — architecture, risk, a problem that survived two fix attempts, a
  trade-off with long-term cost. An escalation, not a routine review step.
- **@observer** — images, PDFs, diagrams. Keeps media bytes out of your context.
- **@council** — multi-model consensus for a decision the user will act on.

## Delegation contract

- Name the scope and the validation owner in the dispatch prompt.
- Reference paths and line numbers. Do not paste file contents.
- Resume an existing session when it fits (`sessionID`); a cold session pays the
  context cost again.
- Parallel writers must not share a write scope. Reconcile every writer lane
  before final validation.
- A cancel is not a rollback. Inspect partial writes before replacing the lane.
- Never reissue an unchanged task after a rejection. Change the scope or the
  context first.
