# Machine map: this OpenCode tree

`~/.config/opencode` is the global config, and it is chezmoi-managed.

## Editing it

- Source of truth: `~/.local/share/chezmoi/dot_config/opencode/`.
- Edit the source and run `chezmoi apply`, or use `chezmoi edit <path>`. Writing
  only the live path leaves the source stale, and the pre-commit hook rejects
  the next commit in the chezmoi repo.
- `node ~/.config/opencode/scripts/check-config.mjs` checks JSON/JSONC parse,
  structural sanity, source↔live drift, and reference rot in `AGENTS.md`. It
  installs the guardrail hook with `--install` (once per fresh clone).
- `bun test` runs `tests/*.test.ts`. `node scripts/probe-guards.mjs` asserts the
  tool guards fire and that the host loads each one.

## Layout

| Path | Holds |
|---|---|
| `AGENTS.md` | always-on rules plus the load-on-demand index |
| `CODING_STANDARDS.md` | the coding contract (see root `AGENTS.md`) |
| `docs/rules/` | conditional rules, loaded on trigger |
| `docs/` | topic docs and research, loaded on demand |
| `plugins/` | v2 plugins, auto-discovered from this directory |
| `scripts/` | config guardrail, guard probe, session reader |
| `skills/` | symlinks into `~/Workspace/github.com/rbelem/skills/*` — edit anywhere, commit in the Workspace repo |
| `oh-my-opencode-slim.jsonc` | agent presets, model chains, per-agent routing prompts |

## Skills

- `~/.agents/skills/` is managed by the `agents` CLI (`skills` command) and
  tracked in `~/.agents/.skill-lock.json`.
- `~/.config/opencode/skills/*` are symlinks into the Workspace repo above.
- `wigolo*` packs are installed by `wigolo skills add …` and tracked in
  `~/.wigolo/skills/receipts.json`, not in the lock file. Their "untracked"
  status in a `skill-maintenance` audit is correct — keep the two registries
  separate.
- `skillspector` scans a skill for security risks: the `skillspector_scan` tool,
  `/skillspector`, and the pre-commit plus CI gate in the Workspace skills repo.

## Docs index

| File | Covers |
|---|---|
| `docs/response-style.md` | status reporting, wording, naming |
| `docs/session-transcripts.md` | reading a session out of the opencode database |
| `docs/opencode-cli-api.md` | read-only CLI, HTTP API, upstream layout, traps |
| `docs/web-webmcp.md`, `docs/web-wigolo.md` | this machine's browser and web facts |
| `docs/copy-on-write-filesystems.md`, `docs/opencode-parallel-agent-workspaces.md` | background research on lanes and filesystems |
