#!/usr/bin/env bun
// OptChat health check — READ ONLY (no writes to any OptChat DB).
//
// Answers: "is the opencode-optchat plugin actually doing its job?"
// A healthy scope has all three:
//   read=true            -> memory permission granted (not revoked)
//   sources>0 & nodes>0 -> originals retained AND summarized
//   jobs with no failures
// A scope is DEAD when read=false (policy revoked) or nothing was retained.
//
// Usage:  bun ~/.config/opencode/scripts/optchat-check.ts [--verbose]
import { homedir } from "node:os";
import { readdirSync, existsSync, statSync } from "node:fs";
import { Database } from "bun:sqlite";

const ROOT = `${homedir()}/.local/share/optchat`;
const verbose = process.argv.includes("--verbose");

// Scope identity = sha256(JSON.stringify([homedir(), projectId]))  (src/adapters/opencode/settings-scope.ts)
const hash = (t: string) => new Bun.CryptoHasher("sha256").update(t).digest("hex");
const scopeOf = (projectId: string) => hash(JSON.stringify([homedir(), projectId, undefined]));

// project id -> worktree path, from the opencode session DBs
const projects = new Map<string, string>();
for (const db of ["opencode.db", "opencode-stable.db", "opencode-local.db"]) {
  const p = `${homedir()}/.local/share/opencode/${db}`;
  if (!existsSync(p)) continue;
  try {
    const d = new Database(p, { readonly: true });
    for (const row of d.query("select id, worktree from project").all() as any[])
      projects.set(row.id, row.worktree);
    d.close();
  } catch {}
}
const byScope = new Map<string, string[]>();
for (const [id, path] of projects) byScope.set(scopeOf(id), [...(byScope.get(scopeOf(id)) ?? []), path]);

if (!existsSync(ROOT)) {
  console.log(`no OptChat root at ${ROOT} — plugin never created a scope`);
  process.exit(0);
}

const scopes = readdirSync(ROOT).filter((d) => existsSync(`${ROOT}/${d}/memory.sqlite`));
console.log(`optchat root: ${ROOT}\nscopes: ${scopes.length}  |  projects known: ${projects.size}\n`);

let healthy = 0;
let revoked = 0;
for (const s of scopes.sort()) {
  const db = new Database(`${ROOT}/${s}/memory.sqlite`, { readonly: true });
  const count = (t: string) => (db.query(`select count(*) n from ${t}`).get() as any).n;
  const sources = count("sources");
  const nodes = count("nodes");
  const jobs = db.query("select status, count(*) n from jobs group by status").all() as any[];
  const sess = db.query("select value from entities where bucket='sessions'").all() as any[];
  const pol = db.query("select value from entities where bucket='policies'").all() as any[];
  const read = pol.length ? JSON.parse(pol[0].value).read : null;
  const share = pol.length ? JSON.parse(pol[0].value).share : null;
  const disabled = sess.filter((r) => JSON.parse(r.value).disabled).length;
  const mtime = statSync(`${ROOT}/${s}/memory.sqlite`).mtime.toISOString().slice(0, 16).replace("T", " ");
  const failed = jobs.find((j) => j.status === "failed");
  const ok = sources > 0 && nodes > 0 && read === true && !failed;
  if (ok) healthy++;
  else if (read === false) revoked++;
  console.log(
    `${ok ? "OK  " : "DEAD"} scope=${s.slice(0, 12)} read=${String(read).padEnd(5)} share=${String(share).padEnd(5)}` +
      ` sources=${String(sources).padEnd(4)} nodes=${String(nodes).padEnd(4)}` +
      ` jobs=${jobs.length ? jobs.map((j) => `${j.status}:${j.n}`).join(",") : "-"}` +
      ` disabledSessions=${disabled}/${sess.length} dbMtime=${mtime}` +
      `${(byScope.get(s) ?? []).map((p) => ` ${p}`).join("")}`,
  );
  if (verbose && jobs.length)
    console.log(
      "       job detail: " + JSON.stringify(db.query("select status, attempts, substr(coalesce(error,''),1,80) err from jobs limit 8").all()),
    );
  db.close();
}
console.log(`\n${healthy}/${scopes.length} scopes healthy  |  ${revoked} scopes with memory permission revoked`);
console.log("Healthy = read=true AND sources>0 AND nodes>0 AND no failed jobs.");
console.log("If read=false everywhere: the global opencode.jsonc `permissions` array needs an");
console.log('  { "action": "optchat.read", "resource": "*", "effect": "allow" }  rule');
console.log("  (and the same for optchat.share) AT THE END of that array.");
