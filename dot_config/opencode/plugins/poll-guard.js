// poll-guard: makes polling a background job structurally impossible.
//
// Why this exists: on 2026-10-20 a session burned ~31 minutes inside
// foreground shell calls — sleeping and re-reading a background job's output
// file while `devbox global install` ran from 19:40 to 20:02. OpenCode's
// background commands return immediately and notify the agent when they
// finish; the rule ("DO NOT poll for completion") was in context and was
// violated a dozen times. A rule that keeps getting violated needs a
// mechanism, not another reminder.
//
// Scope: a `sleep` in the shell tool whose duration is at or above
// POLL_GUARD_MIN_SECONDS (default 30). Short sleeps are left alone — a
// command may legitimately need a beat between two steps.
//
// Escape hatch: POLL_GUARD_BYPASS=1 for the rare case where the long sleep
// IS the point (a hardware settle, a deliberate rate limit). The variable is
// read from the COMMAND, not from the process env: the documented form is an
// env prefix on the command ("POLL_GUARD_BYPASS=1 <cmd>"), and that sets it
// for that one command only - the way identity-guard does it.
//
// One file serves OpenCode v1 (hook map via server()) and v2
// (default {id, setup(ctx)} that registers ctx.tool.hook("execute.before", cb)).

const DEFAULT_MIN_SECONDS = 30;

// The escape hatch, as it appears in a command.
const BYPASS = "POLL_GUARD_BYPASS=1";

// `sleep 30`, `sleep 30s`, `sleep 2m`, `sleep 1h`, `sleep infinity`.
const SLEEP = /\bsleep\s+(infinity|([0-9]+(?:\.[0-9]+)?)([smhd]?))\b/gi;

const UNIT_SECONDS = { "": 1, s: 1, m: 60, h: 3600, d: 86400 };

// The shell tool is `shell` in OpenCode v2 and `bash` in v1. Both must be
// accepted or the guard never fires.
function isShellTool(tool) {
  return tool === "shell" || tool === "bash";
}

function minSeconds() {
  const configured = Number(process.env.POLL_GUARD_MIN_SECONDS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MIN_SECONDS;
}

// The duration a sleep token asks for, in seconds. Infinity stays infinity.
function sleepSeconds(token) {
  if (/^infinity$/i.test(token)) return Infinity;
  const match = /^([0-9]+(?:\.[0-9]+)?)([smhd]?)$/i.exec(token);
  if (!match) return 0;
  return Number(match[1]) * (UNIT_SECONDS[match[2].toLowerCase()] ?? 1);
}

// Returns a deny reason, or null to allow.
export function pollingSleepReason(command) {
  if (typeof command !== "string" || command.length === 0) return null;
  if (command.includes(BYPASS)) return null;
  const min = minSeconds();
  const long = [];
  for (const match of command.matchAll(SLEEP)) {
    const seconds = sleepSeconds(match[1]);
    if (seconds >= min) long.push(match[0].trim());
  }
  if (long.length === 0) return null;
  return (
    "Blocked by poll-guard: " +
    long.join(", ") +
    " in a foreground shell call. A long job notifies you when it finishes — " +
    "run it with `background: true` and wait for the completion notification " +
    "instead of sleeping and re-reading its output. If the long sleep is the " +
    "point, prefix the command with POLL_GUARD_BYPASS=1."
  );
}

// OpenCode v1 hook map, command in `output.args`.
function v1Hooks() {
  return {
    "tool.execute.before": async (input, output) => {
      if (!input || !isShellTool(input.tool)) return;
      const reason = pollingSleepReason(output?.args?.command);
      if (reason) throw new Error(reason);
    },
  };
}

export default {
  id: "poll-guard",
  server: async () => v1Hooks(),
  async setup(ctx) {
    await ctx.tool.hook("execute.before", async (event) => {
      if (!event || !isShellTool(event.tool)) return;
      const reason = pollingSleepReason(event.input && event.input.command);
      if (reason) throw new Error(reason);
    });
  },
};
