# Global OpenCode Rules

Prioritize retrieval-led reasoning over pretrained-knowledge-led reasoning.
If a project AGENTS.md conflicts with this file, the project file wins.

## Delegation: Use Judgment

Do work directly or delegate to a specialist — pick whichever costs less
(tokens + latency) for the actual task at hand. Delegation has real
overhead: dispatch prompts, background-task bookkeeping, session setup,
context hand-off. Default to doing it yourself unless the task is clearly
suited to a specialist (deep, multi-step, or high-stakes) AND the
delegation overhead will pay for itself. For changes that span multiple
folders, parallel @fixer instances per folder can help, but only when the
parallel work has real isolation. When in doubt, do it yourself.

## Lanes: Use the Cow Worktree Plugin

When spinning multiple parallel lanes that will edit code
(worktree-per-lane fan-out), create each lane with the cow worktree plugin
(`spawn_workspace`), never raw `git worktree add`. Plugin-registered lanes
get inventory tracking (`list_worktrees`), session attach/refuse
protection, and cross-session visibility; bare git worktrees are invisible
to every other session and race-prone. On spawn failure recover through
the plugin (`list_worktrees`); leave commit/stage breadcrumbs in a lane
before handoff so the next session grounds on disk, not the registry.

## Coding Standards

**Code** — before writing or editing code (not a shell one-liner, not a
throwaway probe): read `~/.config/opencode/CODING_STANDARDS.md`. It is not
advice, it is the contract the reviewer holds you to — §4's plan format
(`1. Step → verify: check`) and §2's complexity gate (≤ 10 per function, with
`[complexity-guard]` violations appended to your write/edit results) both
apply to you.

**The two rules that actually bite, inlined so they are in context while you
implement** (the full file still wins):

- **Surgical changes** — touch only what the request requires. Do not
  "improve" adjacent code, comments or formatting; do not refactor what is
  not broken; match the existing style even if you would write it
  differently. Mention unrelated dead code, do not delete it unasked. Remove
  only the imports and variables YOUR change orphaned. Every changed line
  traces to the request.
- **Plan format** — for multi-step work, write the plan before the first
  edit, one verifiable step per line: `1. [Step] → verify: [check]`. Make
  each step verifiable ("add validation" → write the failing test, then make
  it pass). Report the strength of the evidence with the claim — n=1 when it
  is one observation, and retract it out loud when a wider sample
  contradicts it.

## Commit Identity (never override)

The `identity-guard` plugin blocks `git -c user.name=…`, `GIT_AUTHOR_*`, and
`GIT_COMMITTER_*`. Commit under the identity the repo already carries
(`git config user.email`). A GitHub no-reply address is safe only when it is
this account's own:
`Rodrigo Belem <856570+rbelem@users.noreply.github.com>`. Any other
`@users.noreply.github.com` string — e.g. `rodrigo@users.noreply.github.com`
— belongs to whoever owns that login, so GitHub credits *their* account.

## Repo Map (this machine)

- `~/.config/opencode/skills/*` are symlinks into
  `~/Workspace/github.com/rbelem/skills/*` (a git checkout). Edit anywhere;
  commit in the Workspace repo.
- `oh-my-opencode-slim.jsonc`, `opencode.jsonc`, `AGENTS.md`, `docs/` are real
  files, chezmoi-managed — the source of truth is the repo at
  `~/.local/share/chezmoi`. **Edit them with `chezmoi edit <path>`** (writes
  the source and reapplies); writing the live path directly leaves the source
  stale and the pre-commit hook blocks the next commit. Save with
  `chezmoi add <file>` (auto-commits). `node ~/.config/opencode/scripts/check-config.mjs`
  verifies parse, structure, and source↔live drift; it installs the guardrail
  hook with `--install` (needed once per fresh clone of the chezmoi repo).
- `~/.agents/skills/build-webmcp-tools` is the upstream Chrome WebMCP skill
  (locked by the skills CLI). Our `webmcp` skill — a symlink into
  `~/Workspace/github.com/rbelem/skills/webmcp/` — adds this machine's browser
  facts. See `~/.config/opencode/docs/web-webmcp.md`.
- `docs/` holds the topic docs: `web-webmcp.md`, `web-wigolo.md`,
  `response-style.md`, `session-transcripts.md`, `opencode-cli-api.md`.
  `scripts/` holds the session-transcript reader and the config guardrail.
- `skillspector` scans a skill for security risks: the `skillspector_scan`
  tool, `/skillspector`, and the pre-commit + CI gate in
  `~/Workspace/github.com/rbelem/skills/`.

## No Narration Bookkeeping (sentinel / board / pre-action)

When a system reminder fires (sentinel, Background Job Board, oracle
availability, etc.) OR you are about to dispatch a long-running lane
after the user has already confirmed the plan: **do NOT narrate the
acknowledgment or restate the plan.** Skip it entirely from the
user-visible output.

1. Sentinel / system reminder with no action needed → respond with
   ONLY the task-relevant content. Silent incorporation.
2. User confirms a plan terse-style → one short clause ("Locked in.
   Dispatching lane A.") then the first tool call.
3. Multi-tool-call turn → emit the bookkeeping preamble ONCE in the
   first chunk; subsequent chunks carry only the tool calls and per-tool
   narration.
4. Research progress → final summary at the end, OR one mid-stream
   checkpoint every ~5 turns.

Track remaining work in todowrite, not in user-visible narration (see
**Task Tracking** below).
After the FIRST turn that acknowledges bookkeeping, subsequent turns
in the same session MUST contain ZERO acknowledgment of the same
reminder, even if the reminder fires again.

## Task Tracking

For any task with 3 or more distinct steps, call `todowrite` BEFORE
starting work. List the steps as todos, keep exactly one `in_progress`
while working, mark an item `completed` the moment it is done and
`cancelled` when it is dropped. The list is the plan — do not restate
it in prose.

`todowrite` replaces the whole list on every call, so always send the
complete set of items, not just the one that changed. Its schema is
`{ content, status }` only — there is no priority field, so put urgency
in the content text ("[high] fix flaky checkout").

## Response style

`~/.config/opencode/docs/response-style.md` holds the status-reporting,
wording, naming, and structure rules. Answer first, evidence after.

## Fetch discipline

After a fetch, quote the relevant excerpt and work from it; don't re-quote whole pages.

Three sources that mislead:

- **Chromium source**: grep.app does not index it. Fetch raw files from the
  GitHub mirror instead — `raw.githubusercontent.com/chromium/chromium/main/<path>`.
- **grep.app is rate-limited**: `gh_grep` returns "Too Many Requests" under
  load. On a 429, fall back to the GitHub tree API + `raw.githubusercontent.com`
  — do not retry the MCP.
- **Skill registry**: `skills find <query>` and
  `https://skills.sh/api/search?q=<query>` list every published skill. Search
  there before hunting GitHub or npm.

## Shell calls

Pass `workdir` instead of prefixing the command with `cd` — the tool takes the
path, and a `cd` prefix breaks when the working directory moves under a
background job.

Cap a command's output at ~8 KB unless the full text is the point
(`| head -c 8000`). `rtk` compresses the common commands (`git`, `gh`, `ls`);
`sqlite3` dumps and `grep -rn` sweeps are not covered, so trim those yourself.

## Opencode itself

`~/.config/opencode/docs/opencode-cli-api.md` — the read-only CLI
(`debug config`, `plugin list`, `reload`), the HTTP API
(`opencode api <namespace>.<method>`), the upstream source layout, and the
traps (`/doc` is the SPA, not a spec). Read it before spelunking upstream
source or guessing an endpoint.

**The shell tool is named `shell`.** `bash` is the v1 internal name — calling
a `bash` tool fails with "No tool named 'bash' is currently available". A
guard plugin must accept both names (`tool !== "bash" && tool !== "shell"`),
or it is inert in v2: the predicate is always true, the hook returns early
and nothing is guarded. `scripts/probe-guards.mjs` asserts this.

## Long-running commands

Anything over ~5 minutes goes to `background: true` with an explicit
`timeout`. A foreground call dies with the server and takes its output with
it; a background call survives and still notifies you.

**Never poll a background job.** The completion notification arrives on its
own; a `sleep` loop that re-reads the output file is pure waste (a past
session burned ~31 minutes that way). The `poll-guard` plugin rejects
`sleep` of 30s or more in the shell tool for exactly this reason —
`POLL_GUARD_BYPASS=1` is the escape hatch.

## Scratch space

Scratch belongs on `/home`, not on the root fs: `/` is 96 G and holds `/nix`,
so it fills up long before it looks full — a build that needs 2 G fails with
ENOSPC while `df` still shows room on `/home`. `~/.cache/opencode-scratch` is
the scratch root (234 G); `/tmp/opencode` holds symlinks into it for the
paths that already existed, so old paths keep resolving.

## Session transcripts

`~/.config/opencode/scripts/session-transcript.sh <session-id> [text|tool|all]`
prints a session from the opencode database. The schema, the session-id
query, and the raw SQL are in `~/.config/opencode/docs/session-transcripts.md`.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

<!-- HERDR_START -->
## Herdr

Herdr is the terminal workspace manager (tmux replacement) — sessions → workspaces → tabs → panes, agent-aware. There is no herdr MCP server; agents drive it through the `herdr` CLI and socket API.

The **herdr skill** (`herdr` in ~/.agents/skills, auto-loaded) teaches pane/workspace control — splitting panes, running commands without stealing focus, reading output, waiting on other agents. Load it when the task involves herdr panes.

**Context:** when opencode runs inside a herdr pane, `HERDR_ENV=1`, `HERDR_PANE_ID`, `HERDR_BIN_PATH`, and `HERDR_SOCKET_PATH` are set. The herdr-agent-state plugin (`~/.config/opencode/plugins/herdr-agent-state.js`) reports lifecycle state (idle/working/blocked) and session identity back to herdr.

### Key CLI surface

| Need | Command |
|---|---|
| Runtime status | `herdr status`, `herdr status server`, `herdr status client` |
| What herdr sees (agents/panes) | `herdr agent list` |
| Why a pane was classified a certain way | `herdr agent explain --json` |
| Send keys to a pane | `herdr pane send-keys <pane_id> <text>` (see skill for exact usage) |
| Read pane output | `herdr pane output <pane_id>` / `--follow` (see skill) |
| Split pane / new tab / new workspace | `herdr pane split`, `herdr tab new`, `herdr workspace new` |
| Report agent state (custom integrations) | `herdr pane report-agent <pane_id> --state working\|idle\|blocked --source <src>` |
| Reload config | `herdr server reload-config` |

Full reference: `herdr --help`, https://herdr.dev/docs/cli-reference/, and the herdr skill.
<!-- HERDR_END -->

<!-- SKILLS_EXTERNALLY_MANAGED_START -->
## Externally managed skills (not in `.skill-lock.json`)

Some skill folders in `~/.agents/skills/` are installed and tracked by their own installer, not the `agents` CLI. They will show as "untracked" in `skill-maintenance` audits — that is correct, not a problem to fix.

| Folder pattern | Installer | Receipts / source of truth | Update | Remove |
|---|---|---|---|---|
| `wigolo*` (11 packs) | `wigolo skills add --global --agent codex` | `~/.wigolo/skills/receipts.json` (versioned, SHA256 per file) | `wigolo skills add --global --agent codex --force` after a wigolo version bump | `wigolo skills remove --global --agent codex [<pack>]` |

**Do not** add these to `~/.agents/.skill-lock.json`. The lock schema is github-sourced only (`sourceType: "github"`); fabricating entries would mislead `agents` sync and risk silent drift. Two clean registries, no overlap.
<!-- SKILLS_EXTERNALLY_MANAGED_END -->
