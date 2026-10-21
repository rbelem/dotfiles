# Shell calls, background jobs, scratch

## Invocation

- Pass `workdir` instead of prefixing the command with `cd`. The tool takes the
  path, and a `cd` prefix breaks when the working directory moves under a
  background job.
- Cap output at ~8 KB (`| head -c 8000`) unless the full text is the point.
  `rtk` compresses `git`, `gh`, and `ls`. `sqlite3` dumps and `grep -rn` sweeps
  are not covered, so trim those yourself.

## Long commands

- Anything over ~5 minutes runs with `background: true` and an explicit
  `timeout`. A foreground call dies with the server and takes its output with
  it; a background call survives and still notifies on completion.
- **Never poll.** The completion notice arrives on its own. On 2026-10-20 a
  session burned ~31 minutes sleeping and re-reading a background job's output
  while `devbox global install` ran from 19:40 to 20:02.
- `poll-guard` now rejects a `sleep` of 30 s or more in the shell tool, which
  makes the "wait and check" loop structurally impossible. `POLL_GUARD_BYPASS=1`
  as a command prefix is the hatch when the long sleep is the point.

## Scratch

- Scratch goes on `/home`, at `~/.cache/opencode-scratch` (234 G). `/tmp/opencode`
  holds symlinks into it, so the old paths keep resolving.
- `/` is 96 G and holds `/nix`. It fills long before it looks full: a build that
  needs 2 G fails with ENOSPC while `df` still shows room on `/home`.
- A path under `/tmp` that another session created is not yours to delete. Ask
  before removing it.
