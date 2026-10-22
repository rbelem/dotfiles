#!/usr/bin/env bash
# Unattended guard check, run by opencode-guard-check.timer.
#
# Why: a tool that regenerates a live plugin (dcg install rewrote a patched
# guard) leaves the guard inert until someone happens to run the probe. The
# pre-commit hook catches it at the next commit to the config repo, which can
# be days away. This runs without a host, so it skips the host-plugin section
# (--no-host) and keeps the hook-level checks plus the drift check.
#
# systemd gives a service a minimal PATH, and the drift check shells out to
# chezmoi: without it, check-config only warns and the drift half silently
# skips. Resolve both tools from the devbox profile when they are not on PATH.
set -uo pipefail

PROFILE_BIN="$HOME/.local/share/devbox/global/default/.devbox/nix/profile/default/bin"
for tool in node chezmoi; do
  command -v "$tool" >/dev/null 2>&1 || PATH="$PROFILE_BIN:$PATH"
done
export PATH

node "$HOME/.config/opencode/scripts/probe-guards.mjs" --no-host || exit 1
exec node "$HOME/.config/opencode/scripts/check-config.mjs"
