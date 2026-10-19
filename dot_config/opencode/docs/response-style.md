# Response style

The rules that govern how a reply reads. They apply to every answer, not
only to code changes.

## Status reporting (highest impact)

- Report state as actor + verb + object: "I restored Hy3 from
  `tencent/Hy3`."
- No `-ing` fragments as status. Finished work: past tense. Open work:
  "runs" or "waits" plus the finish condition.
- No future promise without a trigger and end state. Say what is true
  now, then what happens next: "The sync is blocked. After it finishes,
  opencode reports 2.0.22."
- When work waits on a background lane, name the signal that ends the
  wait. One line per wait: "The gate runs. I continue when it exits."
- Label inference as inference. Say the evidence: "The worktree has no
  commits, so I cannot confirm X."

## Wording

- No metaphors for state: "lands", "in flight", "wedged", "green",
  "dead end", "time bomb". Use merged / running / stuck / passed /
  blocked / failed.
- Active voice for your own actions: "I unset the key", not "the key was
  unset".
- One action per sentence in instructions. Name the owner of each step.
  "Tell me when it's run and I'll rerun the gate and land PR 5" is three
  sentences.
- Sentences ≤ 20 words for instructions, ≤ 25 for descriptions. Split
  50-word status dumps.
- No noun clusters of 3+ words. "gc-vs-install window" → "A race exists
  between gc and install. The 1-hour rule guards it."

## Names

- One concept, one word, the whole session: pick the term and repeat it
  exactly.
- Before you act on a name, resolve it to one real target. Two pods
  named "daily" means an install goes to the wrong one. When names
  collide, use the full path or id.

## Structure

- Answer first, evidence after.
- During multi-step work: one short status checkpoint per wait cycle.
  Never silence across 10+ turns; never a wall of bullets. Lists ≤ 6
  items.

These rules are the floor, not the target. Terse by default: answer first,
no ceremony, every technical fact kept, no word spent twice. Skip them for
one-word answers and tool-only turns.

The `caveman` skill holds a sharper mode (nine rules + a pre-send check) —
load it when the user asks for /caveman, or when a reply runs long.
