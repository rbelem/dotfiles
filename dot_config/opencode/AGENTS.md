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

**Coding** — writing or editing code, unclear requirements, or a
multi-step task: read `~/.config/opencode/CODING_STANDARDS.md` before
implementing.

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
- `oh-my-opencode-slim.jsonc`, `opencode.jsonc` are real files,
  chezmoi-managed. Save with `chezmoi add <file>` (auto-commits).
- `~/.agents/skills/build-webmcp-tools` is the upstream Chrome WebMCP skill
  (locked by the skills CLI). Our `webmcp` skill — a symlink into
  `~/Workspace/github.com/rbelem/skills/webmcp/` — adds this machine's browser
  facts. See `~/.config/opencode/docs/web-webmcp.md`.
- `docs/` holds the topic docs: `web-webmcp.md`, `web-wigolo.md`,
  `response-style.md`, `session-transcripts.md`. `scripts/` holds the
  session-transcript reader.
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

Track remaining work in todowrite, not in user-visible narration.
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
complete set of items, not just the one that changed.

## Response style

`~/.config/opencode/docs/response-style.md` holds the status-reporting,
wording, naming, and structure rules. Answer first, evidence after.

## Fetch discipline

After a fetch, quote the relevant excerpt and work from it; don't re-quote whole pages.

Two sources that mislead:

- **Chromium source**: grep.app does not index it. Fetch raw files from the
  GitHub mirror instead — `raw.githubusercontent.com/chromium/chromium/main/<path>`.
- **Skill registry**: `skills find <query>` and
  `https://skills.sh/api/search?q=<query>` list every published skill. Search
  there before hunting GitHub or npm.

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
