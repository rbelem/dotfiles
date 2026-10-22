# Global OpenCode Rules

Retrieval-led reasoning over pretrained knowledge. A project `AGENTS.md` wins
over this file.

## Always on

- **Commit identity.** `identity-guard` blocks `git -c user.name=…`,
  `GIT_AUTHOR_*`, and `GIT_COMMITTER_*`. Commit under the identity the repo
  already carries. The one safe no-reply address is this account's own:
  `Rodrigo Belem <856570+rbelem@users.noreply.github.com>`. Any other
  `@users.noreply.github.com` string credits whoever owns that login.
- **The shell tool is `shell`.** `bash` is the v1 name. A guard that matches only
  `bash` never fires, because the predicate is always true.
  `scripts/probe-guards.mjs` asserts both names and that the host loads each
  guard.
- **Shell calls.** Pass `workdir` instead of a `cd` prefix. Cap output at ~8 KB
  unless the full text is the point.
- **Long commands.** Over ~5 minutes runs with `background: true` and an explicit
  `timeout`. Never poll: the completion notice arrives on its own, and
  `poll-guard` rejects `sleep` ≥ 30 s (`POLL_GUARD_BYPASS=1` is the hatch).
- **Scratch.** `~/.cache/opencode-scratch`, reachable as `/tmp/opencode`. `/` is
  96 G and holds `/nix`, so it fills before it looks full.
- **No narration.** No "board clean" or "sentinel acknowledged" preamble, and no
  restating a plan after a terse go-ahead. One clause, then tool calls.
- **`todowrite` for 3+ distinct steps**, before the first step, one item
  `in_progress` at a time. The orchestrator prompt repeats this trigger on
  purpose: measured 6/6 with it against 5/9 on the file rule alone (2026-10-20).

## Before the first code or config edit

`CODING_STANDARDS.md` is the contract, not advice: minimum code, surgical
changes, a verifiable plan (`1. Step → verify: check`), and evidence strength
stated with the claim. `plugins/coding-standards-gate.js` blocks the first code,
config, or script edit of a session and puts the file in the error — read it and
retry the same edit. `complexity-guard` appends `[complexity-guard]` violations
to write and edit results; split the named functions before finishing.

## Load on demand

opencode does not parse file references, so these are explicit reads. Read the
file before acting in its area. Once the trigger matches, the content is
mandatory, not background material.

| Trigger | File |
|---|---|
| Dispatching, resuming, or cancelling a lane; weighing specialist against self | `docs/rules/delegation.md` |
| About to explain a sentinel or board state, or restate a plan | `docs/rules/narration.md` |
| Choosing a shell invocation, backgrounding a command, or writing to scratch | `docs/rules/shell-and-jobs.md` |
| Editing anything under `~/.config/opencode`, or locating a skill or doc | `docs/rules/machine-map.md` |
| Guessing an opencode CLI or API call, writing a plugin, reading a transcript, driving herdr | `docs/rules/opencode-internals.md` |
| Web search, `gh_grep`, a raw GitHub fetch, or finding a published skill | `docs/rules/web-research.md` |
| Response wording, status reporting, or naming | `docs/response-style.md` |

## Code lookup

A repo with `graphify-out/` or `.codegraph/` gets a graph query before grep:
`graphify query "<question>"`, or `codegraph explore "<symbols or question>"`.
Both return a scoped subgraph, usually far smaller than the raw files.
`docs/rules/opencode-internals.md` has the full form.

## Editing this config tree

Everything here is chezmoi-managed. Edit the source at
`~/.local/share/chezmoi/dot_config/opencode/` and run `chezmoi apply`, or use
`chezmoi edit <path>`. Writing only the live path leaves the source stale and the
pre-commit hook rejects the commit.
`node ~/.config/opencode/scripts/check-config.mjs` verifies parse, structure,
drift, and that every file named above still exists.
A tool that regenerates a live file (dcg install rewrote a patched guard) makes
`chezmoi apply` refuse it, and it fails without a TTY: restore the source with
`chezmoi apply --force <path>`.
After editing a plugin or a guard script, run
`node ~/.config/opencode/scripts/probe-guards.mjs` and only then the live copy,
so a stale live version does not answer as the old one.
