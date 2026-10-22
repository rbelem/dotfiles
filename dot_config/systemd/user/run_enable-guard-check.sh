#!/usr/bin/env bash
# Enable the daily guard-check timer when a user manager exists.
#
# Plain run_ (not run_onchange_): a skip must stay retryable, and recording a
# skip as success would never retry it. Exits 0 with a note when there is no
# systemd user manager (headless apply, containers) — the pre-commit hook
# remains the backstop there.
set -uo pipefail

if ! systemctl --user show-environment >/dev/null 2>&1; then
  echo "guard-check timer: no systemd user manager — enable manually with: systemctl --user enable --now opencode-guard-check.timer"
  exit 0
fi

systemctl --user daemon-reload
systemctl --user enable --now opencode-guard-check.timer
