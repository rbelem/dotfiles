// identity-guard: blocks shell commands that override the git commit identity.
//
// Why this exists: on 2026-09-22 an overnight agent committed 17 times with
//   git -c user.name="rodrigo" -c user.email="rodrigo@users.noreply.github.com"
// and GitHub credited those commits to the unrelated GitHub account `rodrigo`
// — the legacy no-reply form `login@users.noreply.github.com` belongs to that
// login, not to this user. Commits must carry the repo's configured identity.
// If a privacy address is wanted, it must be this account's own no-reply:
// 856570+rbelem@users.noreply.github.com.
//
// Scope: only silent per-command overrides — `git -c user.name=/-c user.email=`
// and the GIT_AUTHOR_*/GIT_COMMITTER_* env prefixes. `git config user.email …`
// is deliberately NOT blocked: test suites set identity inside throwaway repos.
//
// Escape hatch: prefix a deliberate sandbox/test override with
// IDENTITY_GUARD_BYPASS=1.
//
// One file serves OpenCode v1 (hook map via server()) and v2
// (default {id, setup(ctx)} that registers ctx.tool.hook("execute.before", cb)),
// the same shape as the generated dcg-guard plugin.
//
// TOOL NAME: the model-facing shell tool is named `shell` in OpenCode v2;
// `bash` is the v1 internal name. A guard that only accepts `bash` is inert
// in v2 — the predicate is always true, the hook returns early, and the
// guard never runs while the global AGENTS.md documents it as active.
// Both names are accepted on both paths. scripts/probe-guards.mjs asserts
// that the v2 path blocks.

const BYPASS = "IDENTITY_GUARD_BYPASS=1";

// `git … -c user.name=|user.email=` within one command segment, or a
// GIT_AUTHOR_*/GIT_COMMITTER_* assignment. Segments end at ; & | newline, so
// `git status && git -c user.email=… commit` still matches the second git;
// `\bgit\b` also catches the flag inside a quoted `bash -c "git -c …"`.
const OVERRIDE = new RegExp(
  String.raw`\bgit\b[^\n;&|]*-c\s+user\.(?:name|email)=` +
    String.raw`|(?:^|[\s;&|(])(?:GIT_AUTHOR|GIT_COMMITTER)_(?:NAME|EMAIL)=`,
);

// The shell tool is `shell` in OpenCode v2 and `bash` in v1. Both must be
// accepted or the guard never fires.
function isShellTool(tool) {
  return tool === "shell" || tool === "bash";
}

// Returns a deny reason, or null to allow.
export function identityOverrideReason(command) {
  if (typeof command !== "string" || command.length === 0) return null;
  if (command.includes(BYPASS)) return null;
  if (!OVERRIDE.test(command)) return null;
  return (
    "Blocked by identity-guard: this command overrides the git commit identity " +
    "(-c user.name/-c user.email or GIT_AUTHOR_*/GIT_COMMITTER_*). " +
    "Commit under the repo's configured identity (git config user.email); a " +
    "GitHub no-reply address must be this account's own, " +
    "856570+rbelem@users.noreply.github.com. For a deliberate throwaway-repo " +
    "test, prefix the command with IDENTITY_GUARD_BYPASS=1."
  );
}

// OpenCode v1 hook map, command in `output.args`.
function v1Hooks() {
  return {
    "tool.execute.before": async (input, output) => {
      if (!input || !isShellTool(input.tool)) return;
      const reason = identityOverrideReason(output?.args?.command);
      if (reason) throw new Error(reason);
    },
  };
}

export default {
  id: "identity-guard",
  server: async () => v1Hooks(),
  async setup(ctx) {
    await ctx.tool.hook("execute.before", async (event) => {
      if (!event || !isShellTool(event.tool)) return;
      const reason = identityOverrideReason(event.input && event.input.command);
      if (reason) throw new Error(reason);
    });
  },
};
