# No narration bookkeeping

When a system reminder fires (sentinel, Background Job Board, oracle
availability) OR you are about to dispatch a long-running lane after the user
already confirmed the plan: **do NOT narrate the acknowledgment or restate the
plan.** Skip it entirely from the user-visible output.

## Anti-patterns

Each one wastes 50-200 tokens per turn, and repeats every turn:

- "Sentinel acknowledged — board clean, no active lanes. The user wants..."
- "Board clean — all lanes reconciled. Continuing with X."
- "Now I have a clear picture. Let me also check Y." (during research)
- Restating the plan after a terse confirmation like "sim" / "manda" / "pode" /
  "go": "OK so the plan is A, then B, then C. Dispatching A first."
- Restating the same plan in a multi-tool-call turn instead of once at the top,
  then letting the tool calls carry the work.

## Correct behaviour

1. Sentinel or system reminder with no action needed → respond with ONLY the
   task-relevant content. Silent incorporation.
2. User confirms a plan terse-style → one short clause ("Locked in. Dispatching
   lane A.") then the first tool call. No re-narration.
3. Multi-tool-call turn → emit the bookkeeping preamble ONCE in the first chunk.
   Later chunks carry only tool calls and per-tool narration. Never paste the
   same preamble before every tool.
4. Research progress → a final summary, or one mid-stream checkpoint every ~5
   turns. Never a "Now I have the picture" preamble per turn.

Track remaining work in `todowrite`, not in narration. The rule for *when* a
todo list exists lives in the root `AGENTS.md` section **Task Tracking**; this
file only covers where the plan may be shown.

After the first turn that acknowledges bookkeeping, later turns in the same
session MUST contain ZERO acknowledgment of the same reminder, even if it fires
again.

## Evidence

This anti-pattern fired 7+ times across zet sessions: memory #244, #609, #817,
#903, #989, #1004, #1009, #1015. The memory layer is exhausted; the rule lives
in a file.
