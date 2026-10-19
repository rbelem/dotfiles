---
description: Scan a skill with NVIDIA SkillSpector for security risks
---

Scan an AI agent skill for security risks: prompt injection, data
exfiltration, privilege escalation, supply chain, rogue agent.

## Usage

```
/skillspector <path>            → scan a skill directory or SKILL.md
/skillspector <path> json       → JSON report instead of the terminal report
/skillspector <path> sarif      → SARIF report (for CI ingestion)
/skillspector <path> <out.sarif> → write the report to a file
```

## What to do

1. Run the `skillspector_scan` tool with the given target. The scanner
   runs static analysis by default — no API key, no network.
2. Read the findings. A skill that ships to other agents runs with full
   permissions, so treat HIGH and CRITICAL findings as blocking.
3. If the finding is a false positive for that skill's purpose (a
   documented `rm -rf`, a docker socket path, a credential-file workflow),
   accept it in a reviewed baseline instead of deleting the rule:
   `.skillspector-baselines/<skill>.yaml` in the skills repo, one glob rule
   per accepted finding, each with a `reason`.
4. Report the verdict, the score, and what was accepted.

The scanner lives in devbox-global (`devbox.d/skillspector`) and is on
PATH inside a devbox shell. Outside one it runs from
`~/.local/bin/skillspector` with a clean `PYTHONPATH` — the plugin already
handles that.
