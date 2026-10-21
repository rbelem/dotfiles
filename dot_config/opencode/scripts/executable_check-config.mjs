#!/usr/bin/env node
// Config guardrail for the opencode config tree.
//
//   check-config.mjs             run the checks (exit 1 on failure)
//   check-config.mjs --install   install the pre-commit hook into the chezmoi repo
//
// Checks:
//   1. every managed JSON/JSONC config file parses (JSONC: comments + trailing commas)
//   2. structural sanity on the opencode config (experimental.* are scalars, plugins
//      entries are strings or { package, options })
//   3. the live tree matches the chezmoi source (no un-synced edits)
//
// The hook runs inside `chezmoi add`, which holds chezmoi's state lock — so
// `chezmoi status`/`diff`/`source-path` all fail there. The drift check
// therefore compares the source tree to the live tree directly, using
// `chezmoi managed` (which does not need the lock) as the authoritative list
// of managed targets.

import { readFileSync, existsSync, copyFileSync, chmodSync, readdirSync, statSync, lstatSync, readlinkSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { homedir } from "node:os"
import { join, relative } from "node:path"

const HOME = homedir()
const CONFIG_DIR = join(HOME, ".config", "opencode")
const CHEZMOI_DIR = join(HOME, ".local", "share", "chezmoi")
const SOURCE_DIR = join(CHEZMOI_DIR, "dot_config", "opencode")
const HOOK_SRC = join(CONFIG_DIR, "scripts", "pre-commit")
const HOOK_DST = join(CHEZMOI_DIR, ".git", "hooks", "pre-commit")

/** chezmoi's file-attribute prefixes. A source file `private_x` becomes target `x`. */
const ATTR_PREFIXES = [
  "private_",
  "executable_",
  "symlink_",
  "encrypted_",
  "exact_",
  "readonly_",
  "create_",
  "remove_",
  "run_",
  "modify_",
  "templates_",
]

const failures = []
const warnings = []
const fail = (msg) => failures.push(msg)
const warn = (msg) => warnings.push(msg)

// ---------------------------------------------------------------- JSONC parse

function stripJsonComments(text) {
  let out = ""
  let i = 0
  let inString = false
  let inLine = false
  let inBlock = false
  while (i < text.length) {
    const c = text[i]
    const n = text[i + 1]
    if (inLine) {
      if (c === "\n") {
        inLine = false
        out += c
      }
      i++
      continue
    }
    if (inBlock) {
      if (c === "*" && n === "/") {
        inBlock = false
        i += 2
        continue
      }
      i++
      continue
    }
    if (inString) {
      out += c
      if (c === "\\") {
        out += n ?? ""
        i += 2
        continue
      }
      if (c === '"') inString = false
      i++
      continue
    }
    if (c === '"') {
      inString = true
      out += c
      i++
      continue
    }
    if (c === "/" && n === "/") {
      inLine = true
      i += 2
      continue
    }
    if (c === "/" && n === "*") {
      inBlock = true
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

function stripTrailingCommas(text) {
  let out = ""
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      out += c
      if (c === "\\") {
        out += text[++i] ?? ""
        continue
      }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      out += c
      continue
    }
    if (c === ",") {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) j++
      if (text[j] === "}" || text[j] === "]") continue
    }
    out += c
  }
  return out
}

const parseJsonc = (text) => JSON.parse(stripTrailingCommas(stripJsonComments(text)))

// --------------------------------------------------------------- config files

function configFiles() {
  const files = []
  for (const entry of readdirSync(CONFIG_DIR)) {
    if (!/\.(json|jsonc)$/.test(entry)) continue
    const full = join(CONFIG_DIR, entry)
    if (!statSync(full).isFile()) continue
    files.push(full)
  }
  return files.sort()
}

function checkParse() {
  for (const file of configFiles()) {
    try {
      parseJsonc(readFileSync(file, "utf8"))
    } catch (error) {
      fail(`parse error: ${file}: ${error.message}`)
    }
  }
}

function checkStructure() {
  const file = join(CONFIG_DIR, "opencode.jsonc")
  if (!existsSync(file)) return
  let config
  try {
    config = parseJsonc(readFileSync(file, "utf8"))
  } catch {
    return // already reported by checkParse
  }
  for (const [key, value] of Object.entries(config.experimental ?? {})) {
    if (typeof value !== "boolean" && typeof value !== "number") {
      fail(`opencode.jsonc: experimental.${key} must be a boolean or number, got ${typeof value}`)
    }
  }
  for (const entry of config.plugins ?? []) {
    if (typeof entry === "string") continue
    if (entry && typeof entry === "object" && typeof entry.package === "string") continue
    fail(`opencode.jsonc: plugins entry must be a string or { package }, got ${JSON.stringify(entry)}`)
  }
}

// ------------------------------------------------------------------ drift

/** Find the source file that produces `target` (relative to CONFIG_DIR). */
function findSource(targetRel) {
  const direct = join(SOURCE_DIR, targetRel)
  if (existsSync(direct)) return { path: direct, prefix: null }
  const parts = targetRel.split("/")
  const base = parts.pop()
  // The attribute prefix lives on the SOURCE name: `private_cli.json` -> `cli.json`.
  for (const prefix of ATTR_PREFIXES) {
    const candidate = join(SOURCE_DIR, ...parts, prefix + base)
    if (existsSync(candidate)) return { path: candidate, prefix }
  }
  return null
}

function compareTarget(targetRel) {
  const live = join(CONFIG_DIR, targetRel)
  // `chezmoi managed` also lists managed directories; they have no source file.
  const liveStats = lstatSync(live, { throwIfNoEntry: false })
  if (liveStats?.isDirectory()) return
  const source = findSource(targetRel)
  if (!source) {
    fail(`drift: cannot map live file to a source: ${targetRel} — update ATTR_PREFIXES in check-config.mjs`)
    return
  }
  if (!liveStats) {
    fail(`drift: ${targetRel} is missing from the live tree`)
    return
  }
  const sourceText = readFileSync(source.path, "utf8")
  if (source.prefix === "symlink_") {
    if (!liveStats.isSymbolicLink()) {
      fail(`drift: ${targetRel} should be a symlink to ${sourceText.trim()}`)
      return
    }
    if (readlinkSync(live) !== sourceText.trim()) {
      fail(`drift: ${targetRel} points at ${readlinkSync(live)}, source says ${sourceText.trim()}`)
    }
    return
  }
  if (readFileSync(live, "utf8") !== sourceText) {
    fail(`drift: ${targetRel} differs from the chezmoi source — run: chezmoi add ${targetRel}`)
  }
  if (source.prefix === "executable_") {
    const mode = liveStats.mode & 0o777
    if (!(mode & 0o100)) fail(`drift: ${targetRel} should be executable (mode ${mode.toString(8)})`)
  }
}

function checkDrift() {
  if (!existsSync(SOURCE_DIR)) return
  let managed = ""
  try {
    managed = execFileSync("chezmoi", ["managed"], { encoding: "utf8", timeout: 30000 })
  } catch (error) {
    warn(`chezmoi managed failed: ${error.message}`)
    return
  }
  const targets = managed
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(".config/opencode/"))
    .map((line) => line.slice(".config/opencode/".length))
  if (targets.length === 0) {
    warn("chezmoi managed listed no .config/opencode targets — drift check is a no-op")
    return
  }
  for (const target of targets.sort()) compareTarget(target)
}

// ---------------------------------------------------------- rule references
//
// AGENTS.md is the only file every session reads, so it is also the only index
// into the conditional rule files. A reference to a moved or renamed file is a
// rule that silently stops applying; a rule file nobody references is dead
// weight. Both fail here, where the pre-commit hook sees them.

const AGENTS_MD = join(CONFIG_DIR, "AGENTS.md")
const RULES_DIR = join(CONFIG_DIR, "docs", "rules")

function checkRuleReferences() {
  if (!existsSync(AGENTS_MD)) return
  const text = readFileSync(AGENTS_MD, "utf8")
  const refs = new Set(text.match(/docs\/[A-Za-z0-9._/-]+\.md/g) ?? [])
  for (const ref of refs) {
    if (!existsSync(join(CONFIG_DIR, ref))) fail(`AGENTS.md references a missing file: ${ref}`)
  }
  if (text.includes("CODING_STANDARDS.md") && !existsSync(join(CONFIG_DIR, "CODING_STANDARDS.md"))) {
    fail("AGENTS.md names CODING_STANDARDS.md, but the file is missing")
  }
  if (!existsSync(RULES_DIR)) return
  for (const entry of readdirSync(RULES_DIR)) {
    if (!entry.endsWith(".md")) continue
    if (!refs.has(`docs/rules/${entry}`)) {
      fail(`docs/rules/${entry} is not referenced from AGENTS.md — a rule no session loads is dead weight`)
    }
  }
}

// ------------------------------------------------------------------- install

function install() {
  if (!existsSync(HOOK_SRC)) {
    console.error(`hook source missing: ${HOOK_SRC}`)
    process.exit(1)
  }
  if (!existsSync(join(CHEZMOI_DIR, ".git", "hooks"))) {
    console.error(`not a git repo: ${CHEZMOI_DIR}`)
    process.exit(1)
  }
  copyFileSync(HOOK_SRC, HOOK_DST)
  chmodSync(HOOK_DST, 0o755)
  console.log(`installed ${HOOK_DST}`)
}

// ---------------------------------------------------------------------- main

const args = process.argv.slice(2)
if (args.includes("--install")) {
  install()
  process.exit(0)
}

checkParse()
checkStructure()
checkDrift()
checkRuleReferences()

for (const message of warnings) console.warn(`warn: ${message}`)
if (failures.length > 0) {
  for (const message of failures) console.error(`fail: ${message}`)
  console.error(`\nconfig check failed (${failures.length} problem(s))`)
  process.exit(1)
}
console.log("config check ok")
