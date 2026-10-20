# Implementation Lane Routing

- For bounded implementation matching a poteto-mode playbook (bug fix with
  root-cause evidence, feature with a named data shape, behavior-preserving
  refactoring, metric hillclimb), delegate to @poteto-agent instead of @fixer.
  It carries the methodology: reproduce first, verify against the real artifact.
- Keep @fixer for purely mechanical, precisely specified edits (apply this
  exact diff, rename across files, bounded follow-up preserving an existing
  design) where methodology overhead does not pay.
- Never route discovery (@explorer), research (@librarian), advisory (@oracle),
  or UI/UX (@designer) work to @poteto-agent.
- Give @poteto-agent file pointers and scope, not inlined context. It reads
  poteto-mode's SKILL.md itself before working.

## Task Tracking

- Track the work itself in `todowrite` (3+ distinct steps): call it before
  starting, one item `in_progress` at a time, mark items `completed` as they
  land. Do not narrate progress in prose instead.
- A delegated lane cannot see your todo list — its session is separate. Name
  the todo item that lane owns in the delegation prompt, and update the list
  yourself when the lane reports back.

Measured 2026-10-20 on the same task, same model, 3+ step work:
with this trigger in the agent prompt the orchestrator used `todowrite` in
6/6 runs; with the rule only in the global AGENTS.md it fell to 5/9. The
default agent reached 6/6 from the AGENTS.md rule alone. Prompt-level
repetition of the trigger is deliberate here — the orchestrator's prompt
dilutes the file-level rule.
