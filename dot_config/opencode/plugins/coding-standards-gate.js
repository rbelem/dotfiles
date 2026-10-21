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
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const STANDARDS = join(homedir(), ".config", "opencode", "CODING_STANDARDS.md");

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

// Sessions that already received the standard. One denial per session, not one
// per file: after the first read the contract is in context for the rest of it.
const delivered = new Set();

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
  delivered.add(session);
  const standards = await readFile(STANDARDS, "utf8").catch(() => null);
  // Never block on a missing file: a broken path must not wedge every edit.
  if (!standards) return null;
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
