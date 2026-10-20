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
// The hook never blocks on the opencode server: a down server is not a config bug.

import { readFileSync, existsSync, copyFileSync, chmodSync, readdirSync, statSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"

const HOME = homedir()
const CONFIG_DIR = join(HOME, ".config", "opencode")
const CHEZMOI_DIR = join(HOME, ".local", "share", "chezmoi")
const HOOK_SRC = join(CONFIG_DIR, "scripts", "pre-commit")
const HOOK_DST = join(CHEZMOI_DIR, ".git", "hooks", "pre-commit")

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
      if (text[j] === "}" || text[j] === "]") continue // drop the comma
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
    const raw = readFileSync(file, "utf8")
    try {
      parseJsonc(raw)
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

// ------------------------------------------------------------------ chezmoi

function checkDrift() {
  if (!existsSync(CHEZMOI_DIR)) return
  let out = ""
  try {
    out = execFileSync("chezmoi", ["status"], { encoding: "utf8", timeout: 30000 })
  } catch (error) {
    warn(`chezmoi status failed: ${error.message}`)
    return
  }
  const lines = out.split("\n").filter((line) => line.trim().length > 0)
  if (lines.length === 0) return
  fail(
    `live tree differs from the chezmoi source (${lines.length} path(s)):\n` +
      lines.map((line) => `    ${line}`).join("\n") +
      "\n  fix: chezmoi add --all   (or: chezmoi diff <path> to inspect)",
  )
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

for (const message of warnings) console.warn(`warn: ${message}`)
if (failures.length > 0) {
  for (const message of failures) console.error(`fail: ${message}`)
  console.error(`\nconfig check failed (${failures.length} problem(s))`)
  process.exit(1)
}
console.log("config check ok")
