# OpenCode CLI, HTTP API, and upstream source

Where to look when you need to inspect the running opencode, drive its HTTP
API, or read upstream source to answer a question about opencode itself.

## `opencode` CLI: the introspection surface

Everything here is read-only and runs against the background server.

| Command | What it gives you |
|---|---|
| `opencode debug config` | the **resolved** config (every file merged, defaults applied) as JSON |
| `opencode plugin list` | loaded plugins, their id, version, source |
| `opencode agent list` | agents and their models |
| `opencode model list` | available models |
| `opencode session list` | sessions |
| `opencode debug paths` | data / config / cache / state roots |
| `opencode reload` | re-read the config without restarting |
| `opencode --version` | the build (the release notes live in the binary too) |

`opencode debug config` is the one to reach for when a config value "isn't
taking effect" — it shows the *merged* result, not the file, so it settles
"which file wins" immediately.

## `opencode api`: the HTTP API

The server serves a JSON HTTP API. The CLI wraps it:

```bash
opencode api <namespace>.<method> [--param key=value] [-d '<json>']
opencode api <METHOD> <path>            # raw path form
```

Operation ids are `namespace.method` and follow the client's namespace
layout. Verified working:

| Operation | Notes |
|---|---|
| `config.get` | resolved config documents (same payload as `debug config`) |
| `plugin.list` | loaded plugins |
| `agent.list` / `model.list` | agents, models |
| `session.list` | sessions |
| `session.context --param sessionID=<id>` | **the session's full message history** — assistant messages with their tool parts, `state.input`, `state.content` |
| `debug.location.list` | known locations on this machine |
| `session.compact --param sessionID=<id> -d '{}'` | force a compaction |

Raw-path equivalents that work:

```bash
opencode api GET  /api/session/<id>/context    # same as session.context
opencode api GET  /api/session/<id>/message    # session messages
opencode api POST /api/session/<id>/compact -d '{}'
```

`session.context` is the one worth remembering: it is how you read what a
session actually contains — which tool was called, with what input, and what
it returned — without scraping the TUI.

### Traps

- **There is no operation-list endpoint.** `opencode api` with no argument
  errors out. The namespaces mirror the client package layout: `agent`,
  `command`, `config`, `credential`, `debug`, `event`, `experimental`,
  `file`, `form`, `generate`, `integration`, `location`, `mcp`, `message`,
  `migration`, `model`, `permission`, `plugin`, `project`, `provider`, `pty`,
  `reference`, `rpc`, `server`, `session`, `shell`, `skill`, `vcs`, `voice`,
  `websearch`, `worktree`.
- **`/doc` and `/swagger.json` on the server are NOT an API spec.** They
  return the TUI's SPA HTML with HTTP 200. A 200 there means "the SPA
  answered", not "here is the spec". Do not spend a call on it.
- **The server port is random** (a high port per server instance). Use
  `opencode api`, not `curl http://localhost:<port>`.
- Params that the client models as nested objects (`sessionID` is
  `{ sessionID: string }` internally) are passed as flat
  `--param sessionID=<id>`.

## Upstream source

The repo is **`anomalyco/opencode`** — the old `sst/opencode` URL redirects
there. v1 and v2 tags coexist on it (`v1.19.x` and `v2.x`); the v2 line is
current. The v2 changelog is at <https://opencode.ai/changelog> and the
release notes are also embedded in the binary.

### Discover the layout with one call, then query it locally

```bash
curl -sL "https://api.github.com/repos/anomalyco/opencode/git/trees/<tag>?recursive=1" -o tree.json
jq -r '.tree[] | select(.path|test("todo")) | .path' tree.json
```

Fetch the tree **once** and `jq` it repeatedly — the tree is a few MB of
JSON and re-fetching it per question is the expensive mistake.

### Read a file

```bash
curl -sL "https://raw.githubusercontent.com/anomalyco/opencode/<tag>/<path>"
```

### Where things live in v2

| Path | Holds |
|---|---|
| `packages/core/src` | server: session, tools, config, permissions, compaction |
| `packages/core/src/tool/plugin/` | built-in tools (`todo.ts` is the native `todowrite`) |
| `packages/tui/src` | TUI: components, sidebar, feature plugins |
| `packages/tui/src/feature-plugins/` | built-in TUI plugins (`sidebar/todo.tsx` is the native sidebar list) |
| `packages/plugin/src` | the plugin API (server `promise/`, TUI `tui/`) |
| `packages/client/src/promise/generated/` | generated HTTP client — the endpoint catalogue |
| `packages/schema/src` | config + session schemas (`config/experimental.ts` is the authoritative `experimental.*` list) |

`packages/client/src/promise/generated/client.ts` is the endpoint catalogue
(2345 lines) and `types.ts` holds the payload types (6018). Grep them from
the shell; do not read them into context.

## The plugin API, as of v2.1.0

A server plugin's `setup(ctx)` gets: `ctx.tool.transform` (add/update/remove
tool definitions), `ctx.storage`, `ctx.event.subscribe`, `ctx.session.hook`
(`"context"`, `"prompt"`, `"compaction"`, `"model.request"`, …), `ctx.session`
(the client API), `ctx.permission`, `ctx.command`, `ctx.rpc`.

- `ctx.session.context({ sessionID })` returns the session's message history —
  the same payload the TUI reads. This is how a plugin reads state that
  another tool (e.g. the native `todowrite`) produced.
- A TUI plugin's `ctx.data.session.message.list(sessionID)` does the same
  client-side, and `ctx.ui.slot({ append | replace: "sidebar.content" })`
  places UI. `replace` suppresses **everything** in that slot, not just one
  claim.
- Two tools with the same name collide: the registry is keyed by name and the
  last `add` wins (`packages/core/src/tool.ts`). Do not register a tool that
  opencode already provides.

## Config schema

`experimental.*` keys are defined in `packages/schema/src/config/experimental.ts`
(`ConfigExperimental.Info`). Unknown keys are ignored, not rejected — a typo
in `experimental` fails silently.
