#!/usr/bin/env node
// probe-guards: asserts the shell guards actually fire.
//
// Why: a dead guard needs a test, not a comment. identity-guard and dcg-guard
// both gate on the tool name, and the model-facing shell tool is named
// `shell` in OpenCode v2 (there is no `bash` tool). A guard that only accepts
// `bash` is inert: the predicate is always true, the hook returns early, and
// nothing is blocked — while the global AGENTS.md documents the block as
// active. That is exactly the state both guards were in on 2026-10-20.
//
// This probe loads each guard plugin from the live plugin directory, calls
// its real v2 hook with the v2 event shape ({tool, input}), and asserts that
// what must be blocked is blocked and what must pass passes.
//
// Usage: node ~/.config/opencode/scripts/probe-guards.mjs
// Exit 0: every guard behaved as documented. Exit 1: a guard is inert.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PLUGIN_DIR = path.join(os.homedir(), ".config/opencode/plugins");

// The guards must block under the v2 tool name AND under the v1 name.
const TOOL_NAMES = ["shell", "bash"];

const CASES = [
  {
    plugin: "identity-guard.js",
    denied: [
      "git -c user.name=Probe -c user.email=probe@example.com commit -m x",
      "GIT_AUTHOR_NAME=Probe git commit -m x",
      "GIT_COMMITTER_EMAIL=probe@example.com git commit -m x",
    ],
    allowed: [
      "git status",
      "git config user.email",
      "IDENTITY_GUARD_BYPASS=1 git -c user.name=Probe commit -m x",
    ],
  },
  {
    plugin: "dcg-guard.js",
    denied: ["rm -rf /nonexistent-probe-test"],
    allowed: ["echo probe-guards-ok"],
  },
  {
    plugin: "poll-guard.js",
    denied: ["sleep 60", "sleep 2m && echo waited", "sleep infinity"],
    allowed: ["sleep 1", "echo probe-guards-ok", "POLL_GUARD_BYPASS=1 sleep 60"],
  },
];

// The plugins are ESM but live in a directory with no package.json, so node
// would read them as CommonJS. Copy to a temp .mjs and import that.
async function loadPlugin(name) {
  const file = path.join(PLUGIN_DIR, name);
  if (!fs.existsSync(file)) throw new Error(`plugin not found: ${file}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "probe-guards-"));
  const copy = path.join(dir, `${name}.mjs`);
  fs.writeFileSync(copy, fs.readFileSync(file, "utf8"));
  const mod = await import(pathToFileURL(copy).href);
  if (!mod.default) throw new Error(`plugin ${name} has no default export`);
  return mod.default;
}

// Register the plugin the way OpenCode v2 does and keep the callback.
async function v2Hook(plugin) {
  let hook;
  await plugin.setup({
    tool: {
      hook: async (_event, callback) => {
        hook = callback;
      },
    },
  });
  if (typeof hook !== "function") {
    throw new Error(`plugin ${plugin.id} registered no execute.before hook`);
  }
  return hook;
}

// Runs one command through the hook. The hook throws BEFORE the command
// would run, so a denied command never executes.
async function attempt(hook, command, tool) {
  try {
    await hook({ tool, input: { command } });
    return { blocked: false, message: "" };
  } catch (err) {
    return { blocked: true, message: String(err?.message ?? err) };
  }
}

let failures = 0;

for (const testCase of CASES) {
  let plugin;
  let hook;
  try {
    plugin = await loadPlugin(testCase.plugin);
    hook = await v2Hook(plugin);
  } catch (err) {
    console.error(`FAIL ${testCase.plugin}: ${err.message}`);
    failures += 1;
    continue;
  }

  for (const tool of TOOL_NAMES) {
    for (const command of testCase.denied) {
      const outcome = await attempt(hook, command, tool);
      if (!outcome.blocked) {
        console.error(`FAIL ${plugin.id} [${tool}]: allowed a command it must block: ${command}`);
        failures += 1;
      } else {
        console.log(`ok   ${plugin.id} [${tool}]: blocked — ${command}`);
      }
    }
    for (const command of testCase.allowed) {
      const outcome = await attempt(hook, command, tool);
      if (outcome.blocked) {
        console.error(`FAIL ${plugin.id} [${tool}]: blocked a command it must pass: ${command}`);
        console.error(`      ${outcome.message.split("\n")[0]}`);
        failures += 1;
      } else {
        console.log(`ok   ${plugin.id} [${tool}]: allowed — ${command}`);
      }
    }
  }
}

if (failures > 0) {
  console.error(`probe-guards: FAILED — ${failures} guard expectation(s) not met`);
  process.exit(1);
}

console.log("probe-guards: ok — every guard blocks what it must and passes what it must");
