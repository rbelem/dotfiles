// SkillSpector as an OpenCode V2 tool.
//
// Runs NVIDIA's SkillSpector against a skill (directory, SKILL.md, zip, or
// Git URL) so an agent can vet a skill before installing it. Skills run with
// the agent's full permissions, so scanning one before it lands in
// ~/.agents/skills/ is a supply-chain check, not a formality.
//
// The scanner ships two ways on this box:
//   - the nix package in devbox-global (devbox.d/skillspector), on PATH
//     inside a devbox shell
//   - a uv tool install at ~/.local/bin/skillspector, which needs a clean
//     PYTHONPATH outside the devbox shell
// SKILLSPECTOR_BIN overrides both.
//
// No package imports (node builtins only): the supervisor decodes a bare
// {id, setup} default export and calls setup with its own context.
//
// ponytail: one tool, no options beyond what the CLI already has; the
// report comes back as text, truncated to a readable size.

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MAX_REPORT_BYTES = 60_000;

function resolveBinary() {
  const explicit = process.env.SKILLSPECTOR_BIN;
  if (explicit && fs.existsSync(explicit)) return explicit;
  const uv = path.join(os.homedir(), ".local/bin/skillspector");
  if (fs.existsSync(uv)) return uv;
  return "skillspector";
}

function run(bin, args, env) {
  return new Promise((resolve) => {
    execFile(bin, args, { env, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ code: error ? (error.code ?? 1) : 0, stdout: stdout || "", stderr: stderr || "" });
    });
  });
}

async function scan(input) {
  const target = String(input.target || "").trim();
  if (!target) {
    return { content: "skillspector_scan: 'target' is required — a skill directory, a SKILL.md path, a zip, or a Git URL." };
  }

  const format = ["terminal", "json", "markdown", "sarif"].includes(input.format) ? input.format : "terminal";
  const noLlm = input.noLlm === false ? false : true;
  const bin = resolveBinary();

  const args = ["scan", target, "--format", format];
  if (noLlm) args.push("--no-llm");

  let reportPath;
  if (input.output) {
    reportPath = path.isAbsolute(input.output) ? input.output : path.resolve(process.cwd(), input.output);
    args.push("--output", reportPath);
  }

  // Outside a devbox shell the uv tool's venv collides with the profile's
  // python3.14 site-packages, so the child runs with a clean PYTHONPATH.
  const env = { ...process.env };
  delete env.PYTHONPATH;
  delete env.PYTHONHOME;

  const result = await run(bin, args, env);

  if (result.code === 2 && !result.stdout.trim()) {
    return { content: `skillspector_scan: scanner failed to start.\n${result.stderr.slice(0, 2000)}` };
  }

  const body = result.stdout.trim() || result.stderr.trim();
  const truncated = body.length > MAX_REPORT_BYTES ? `${body.slice(0, MAX_REPORT_BYTES)}\n\n[report truncated — ${body.length} bytes]` : body;

  const verdict = result.code === 0 ? "no blocking findings" : `scanner exit ${result.code} — see findings below`;
  const written = reportPath ? `\nReport written to ${reportPath}` : "";
  return { content: `skillspector_scan ${target} — ${verdict}\n\n${truncated}${written}` };
}

export default {
  id: "local.skillspector",
  setup: async (ctx) => {
    await ctx.tool.transform((draft) => {
      draft.add({
        name: "skillspector_scan",
        options: { codemode: false },
        description:
          "Scan an AI agent skill for security risks with NVIDIA SkillSpector: prompt injection, data exfiltration, privilege escalation, supply chain, rogue agent. Target is a skill directory, SKILL.md file, zip, or Git URL. Static analysis only unless noLlm is false.",
        input: {
          type: "object",
          properties: {
            target: { type: "string", description: "Skill to scan: local path, .md/.zip file, or Git/file URL" },
            format: {
              type: "string",
              enum: ["terminal", "json", "markdown", "sarif"],
              default: "terminal",
              description: "Report format",
            },
            noLlm: { type: "boolean", default: true, description: "Skip LLM analysis (static checks only)" },
            output: { type: "string", description: "Optional path to write the report to" },
          },
          required: ["target"],
        },
        output: { type: "string" },
        execute: (input) => scan(input),
      });
    });
  },
};
