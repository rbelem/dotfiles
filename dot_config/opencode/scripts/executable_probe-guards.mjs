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
// It also asserts the host LOADS each guard: a guard that sits in the plugin
// directory but is not loaded by the running host blocks nothing, and the
// hook-level cases above stay green. `opencode plugin list` is the host's own
// answer to "is this plugin active", so the probe reads it.
//
// That listing has two sources: the running server's plugin registry and the
// TUI's local directory discovery. The registry can come back EMPTY while
// the server is still booting, and an empty registry looks exactly like "the
// guards are not loaded". So the probe retries and only judges the listing
// once the server has actually answered.
//
// Usage: node ~/.config/opencode/scripts/probe-guards.mjs
// Exit 0: every guard behaved as documented. Exit 1: a guard is inert.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

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
const guardFiles = new Set();

for (const testCase of CASES) {
  let plugin;
  let hook;
  try {
    plugin = await loadPlugin(testCase.plugin);
    guardFiles.add(path.join(PLUGIN_DIR, testCase.plugin));
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

// coding-standards-gate: blocks the FIRST code/config edit of a session with the
// full standards text in the error, then passes. A markdown edit never blocks.
{
  const name = "coding-standards-gate.js";
  try {
    const plugin = await loadPlugin(name);
    const hook = await v2Hook(plugin);
    guardFiles.add(path.join(PLUGIN_DIR, name));

    const runEdit = async (sessionID, filePath) => {
      try {
        await hook({ tool: "edit", sessionID, input: { filePath } });
        return null;
      } catch (err) {
        return String(err?.message ?? err);
      }
    };

    const expectBlocked = async (sessionID, filePath, needle) => {
      const message = await runEdit(sessionID, filePath);
      if (!message) {
        console.error(`FAIL ${plugin.id}: allowed the first code edit: ${filePath}`);
        failures += 1;
      } else if (!message.includes(needle)) {
        console.error(`FAIL ${plugin.id}: blocked ${filePath} without carrying the standard`);
        failures += 1;
      } else {
        console.log(`ok   ${plugin.id}: blocked first edit — ${filePath}`);
      }
    };

    const expectAllowed = async (sessionID, filePath, why) => {
      const message = await runEdit(sessionID, filePath);
      if (message) {
        console.error(`FAIL ${plugin.id}: blocked ${why}: ${filePath}`);
        failures += 1;
      } else {
        console.log(`ok   ${plugin.id}: allowed ${why} — ${filePath}`);
      }
    };

    await expectBlocked("ses_probe_gate_a", "/tmp/opencode/probe.ts", "Surgical Changes");
    await expectAllowed("ses_probe_gate_a", "/tmp/opencode/probe.ts", "the retried edit");
    await expectAllowed("ses_probe_gate_md", "/tmp/opencode/notes.md", "a markdown edit");
    await expectBlocked("ses_probe_gate_json", "/tmp/opencode/settings.jsonc", "Simplicity First");

    process.env.CODING_STANDARDS_GATE = "off";
    await expectAllowed("ses_probe_gate_off", "/tmp/opencode/off.ts", "the documented bypass");
    delete process.env.CODING_STANDARDS_GATE;
  } catch (err) {
    console.error(`FAIL ${name}: ${err.message}`);
    failures += 1;
  }
}

// The host must LOAD each guard. A guard that is present in the plugin
// directory but absent from the running host's plugin list blocks nothing,
// and the hook-level cases above would still be green.
const HOST_PROBE_ATTEMPTS = 3;
const HOST_PROBE_DELAY_MS = 400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A server-side plugin row is a FILE (.js/.ts); the TUI rows are directories.
// So a file row is the proof that the server answered with its registry.
function serverRows(output) {
  return output
    .split("\n")
    .slice(1)
    .filter((line) => /\.[cm]?[jt]sx?$/.test(line.trim()));
}

async function hostPluginList() {
  let output = "";
  for (let attempt = 1; attempt <= HOST_PROBE_ATTEMPTS; attempt++) {
    output = execFileSync("opencode", ["plugin", "list"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (serverRows(output).length > 0) return output;
    if (attempt < HOST_PROBE_ATTEMPTS) await sleep(HOST_PROBE_DELAY_MS);
  }
  return output;
}

let hostList = null;
try {
  hostList = await hostPluginList();
} catch (err) {
  console.error(`FAIL host: could not run \`opencode plugin list\`: ${err.message}`);
  failures += 1;
}

if (hostList !== null) {
  if (serverRows(hostList).length === 0) {
    console.error(
      `FAIL host: the host reported no server-side plugins after ${HOST_PROBE_ATTEMPTS} attempts — the guards cannot be confirmed`,
    );
    failures += 1;
  } else {
    for (const file of guardFiles) {
      if (hostList.includes(file)) {
        console.log(`ok   host: loads ${file}`);
      } else {
        console.error(`FAIL host: does not load ${file} — the guard is inert in the running host`);
        failures += 1;
      }
    }
  }
}

if (failures > 0) {
  console.error(`probe-guards: FAILED — ${failures} guard expectation(s) not met`);
  process.exit(1);
}

console.log("probe-guards: ok — every guard blocks what it must, passes what it must, and the host loads it");
