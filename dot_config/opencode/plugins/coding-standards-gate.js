// coding-standards-gate: loads CODING_STANDARDS.md into a session that starts
// editing code, config, or scripts — and only into one of those.
//
// Why this exists: the rule used to be a sentence in AGENTS.md ("read
// CODING_STANDARDS.md before writing code"). Nothing enforced it, so no session
// did, and the file sat unused. The other documented option is the
// `instructions` array in opencode.jsonc, which loads a file into EVERY session
// — chat, research, and one-word answers included — and pays its tokens every
// time. So: the first code/config/script edit of a session is denied once, with
// the standard in the error message. The model reads it and retries the same
// edit; from then on the session edits freely.
//
// Scope: write/edit on a path whose extension or basename is code, config, or a
// script. Markdown, images, data dumps, and logs pass untouched.
// Escape hatch: CODING_STANDARDS_GATE=off.
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const STANDARDS = join(homedir(), ".config", "opencode", "CODING_STANDARDS.md");
// Delivery is recorded on disk per session: the host restarts often enough that
// an in-memory Set re-denied the same session's edits (three times in one run),
// and one of those re-denials fed a retry loop. Markers are tiny and pruned.
const STATE_DIR = join(homedir(), ".local", "state", "opencode", "coding-standards-gate");
const MARKER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const CODE_EXTENSIONS = new Set([
  // languages
  "ts", "tsx", "js", "mjs", "cjs", "jsx", "mts", "cts", "py", "rb", "go", "rs",
  "java", "kt", "kts", "c", "h", "cc", "cpp", "hpp", "hh", "cs", "php", "lua",
  "pl", "pm", "swift", "scala", "ex", "exs", "hs", "sol", "dart", "vue", "svelte",
  "astro", "zig", "nim", "jl", "r", "sql", "proto", "graphql", "gql",
  // shells and build scripts
  "sh", "bash", "zsh", "fish", "ps1", "bat", "mk", "cmake", "gradle", "bats",
  // config and infrastructure
  "json", "jsonc", "json5", "yaml", "yml", "toml", "ini", "cfg", "conf",
  "properties", "nix", "tf", "tfvars", "hcl", "xml", "env",
  // markup and style
  "html", "htm", "css", "scss", "sass", "less",
]);

const CODE_NAMES = new Set([
  "Dockerfile", "Containerfile", "Makefile", "makefile", "Justfile", "justfile",
  "Procfile", "Caddyfile", "Vagrantfile", "Gemfile", "Rakefile",
  ".env", ".envrc", ".editorconfig", ".gitignore", ".gitattributes", ".npmrc",
  ".dockerignore",
]);

// Sessions that already received the standard, in this process. One denial per
// session, not one per file: after the first read the contract is in context.
const delivered = new Set();

/** Marker filename for a session id (ids are opaque; keep them path-safe). */
function markerPath(session) {
  return join(STATE_DIR, String(session).replace(/[^A-Za-z0-9_-]/g, "_"));
}

/** Identity of the standards text, so editing the standard re-arms the gate.
 * mtime plus size is one stat, cheap enough to run per code edit. */
async function standardsVersion() {
  const info = await stat(STANDARDS).catch(() => null);
  return info ? `${info.mtimeMs}:${info.size}` : null;
}

/** True when an earlier host process delivered THIS version of the standard. */
async function deliveredBefore(session) {
  const version = await standardsVersion();
  if (!version) return false;
  try {
    const marker = JSON.parse(await readFile(markerPath(session), "utf8"));
    return marker?.version === version;
  } catch {
    return false;
  }
}

/** Drop markers older than the TTL so the directory stays bounded. */
async function pruneMarkers(now = Date.now()) {
  const names = await readdir(STATE_DIR).catch(() => []);
  await Promise.all(
    names.map(async (name) => {
      const p = join(STATE_DIR, name);
      const info = await stat(p).catch(() => null);
      if (info && now - info.mtimeMs > MARKER_TTL_MS) await rm(p, { force: true }).catch(() => {});
    }),
  );
}

async function markDelivered(session) {
  const version = await standardsVersion();
  if (!version) return;
  try {
    await mkdir(STATE_DIR, { recursive: true });
    await writeFile(markerPath(session), JSON.stringify({ at: new Date().toISOString(), version }));
    await pruneMarkers();
  } catch {
    // Best-effort: an unwritable state dir must never wedge every edit.
  }
}

/** True when editing `filePath` counts as writing code, config, or a script. */
export function isCodeTarget(filePath) {
  if (typeof filePath !== "string" || filePath === "") return false;
  if (/node_modules|\/\.git\//.test(filePath)) return false;
  const base = filePath.slice(filePath.lastIndexOf("/") + 1);
  if (CODE_NAMES.has(base)) return true;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return false;
  return CODE_EXTENSIONS.has(base.slice(dot + 1).toLowerCase());
}

function editedPath(input) {
  const rec = input && typeof input === "object" ? input : {};
  const filePath = rec.filePath ?? rec.file_path ?? rec.path;
  return typeof filePath === "string" ? filePath : undefined;
}

/** The denial message, or null when nothing should be blocked. */
export async function gateReason(event) {
  if (!event || (event.tool !== "write" && event.tool !== "edit")) return null;
  if (process.env.CODING_STANDARDS_GATE === "off") return null;
  const filePath = editedPath(event.input);
  if (!isCodeTarget(filePath)) return null;
  const session = event.sessionID ?? "unknown";
  if (delivered.has(session)) return null;
  if (await deliveredBefore(session)) {
    delivered.add(session);
    return null;
  }
  delivered.add(session);
  const standards = await readFile(STANDARDS, "utf8").catch(() => null);
  // Never block on a missing file: a broken path must not wedge every edit.
  if (!standards) return null;
  await markDelivered(session);
  return (
    `[coding-standards] ${filePath} is code, config, or a script. ` +
    `CODING_STANDARDS.md is the contract for this session — read it, then retry ` +
    `the same edit. It is not blocked again.\n\n${standards}`
  );
}

export default {
  id: "coding-standards-gate",
  // OpenCode v2: `setup(ctx)` registers the hook; throwing from execute.before
  // denies the tool call and the message becomes the tool error.
  async setup(ctx) {
    await ctx.tool.hook("execute.before", async (event) => {
      const reason = await gateReason(event);
      if (reason) throw new Error(reason);
    });
  },
};
