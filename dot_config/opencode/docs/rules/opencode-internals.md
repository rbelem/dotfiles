# OpenCode internals

## The tool-name trap

The model-facing shell tool is `shell` in v2. `bash` is the v1 name. A guard
plugin that matches only `bash` is inert: the predicate is always true, the hook
returns early, nothing is guarded — while `AGENTS.md` claims the block is
active. That was the state of `identity-guard` and `dcg-guard` on 2026-10-20.
Accept both names. `scripts/probe-guards.mjs` asserts it, and asserts that the
host loads each guard.

## Plugins

- Files in `plugins/` are auto-discovered. No config entry registers them.
- v2 shape: default export `{ id, setup(ctx) }`, then
  `ctx.tool.hook("execute.before" | "execute.after", async (event) => …)`.
- A hook may mutate `event.input` (before) or `event.result` (after). **Throwing
  from `execute.before` denies the tool call**, and the message becomes the tool
  error — that is how `dcg-guard`, `poll-guard`, and `coding-standards-gate`
  block.
- v1 read a `server()` hook map; v1.3.4+ reads `server()`, v2 reads `id` plus
  `setup()`. One file can serve both by exporting both.
- Type definitions: `node_modules/@opencode-ai/plugin/dist/`.

## CLI and API

`docs/opencode-cli-api.md` is the reference: `opencode debug config` for the
resolved config, `opencode plugin list`, `opencode reload`, the HTTP API behind
`opencode api <namespace>.<method>`, and the traps. `/doc` is the SPA, not a
spec — read the doc before guessing an endpoint.

## Session transcripts

`~/.config/opencode/scripts/session-transcript.sh <session-id> [text|tool|all]`
prints a session from the opencode database. The schema, the session-id query,
and the raw SQL are in `docs/session-transcripts.md`.

## Code lookup

A repo with `.codegraph/` gets `codegraph explore "<symbols or question>"` (or
the `codegraph_explore` MCP tool) before grep or file reads: one call returns the
relevant symbols' source plus the call paths between them, including
dynamic-dispatch hops grep cannot follow. A repo with `graphify-out/` gets
`graphify query "<question>"`, `graphify path`, or `graphify explain` before
reading raw files. No index directory, no graph: indexing is the user's decision.

## herdr

Herdr is a terminal workspace manager — sessions, workspaces, tabs, panes, and
agent-aware. opencode runs inside it. There is no herdr MCP server: drive it
with the `herdr` CLI and its socket API, and load the `herdr` skill for pane
control.

| Need | Command |
|---|---|
| Runtime status | `herdr status`, `herdr status server`, `herdr status client` |
| What herdr sees | `herdr agent list` |
| Why a pane was classified a way | `herdr agent explain --json` |
| Read pane output | `herdr pane output <pane_id>` / `--follow` |
| Report agent state | `herdr pane report-agent <pane_id> --state working\|idle\|blocked --source <src>` |
| Reload config | `herdr server reload-config` |

Inside a pane, `HERDR_ENV=1`, `HERDR_PANE_ID`, `HERDR_BIN_PATH`, and
`HERDR_SOCKET_PATH` are set. `plugins/herdr-agent-state.js` reports lifecycle
state and session identity back to herdr.
