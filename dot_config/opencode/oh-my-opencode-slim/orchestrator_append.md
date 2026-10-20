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

A delegated lane cannot see your todo list — its session is separate. Name
the todo item that lane owns in the delegation prompt, and update the list
yourself when the lane reports back. The rule for *when* to open a list lives
in the global `AGENTS.md` section **Task Tracking**.
