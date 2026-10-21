---
description: pstack per-role model overrides (unlisted roles run on their seat or agent default)
alwaysApply: true
---
# pstack model overrides for the multi-model roles. One line per overridden role; delete a line to fall back to the seat chain or the agent default.
# Seat roles (code, judgment, `how` explorers and explainer) are not listed; they run on their oh-my-opencode-slim chains.
# `inherit-parent` or `auto` as a value: the role runs on the parent chat model (omit Task `model`). Alias entries in a panel list still count toward its fan-out.
# Only OpenCode Go models whose Go Plus monthly allowance is $90 or larger appear here. The $60 models (grok-4.7, kimi-k3, qwen3.8-max, gpt-6-luna, claude-haiku-5-5) are excluded: grok-4.7 cost $10.13 in a single day and broke the weekly window.
# budget: large — as picked
why investigators: opencode-go/deepseek-v4.1-flash#high
why synthesizer: opencode-go/glm-5.3#max
reflect tooling: opencode-go/deepseek-v4.1-flash#high
reflect judgment, divergent, synthesizer: opencode-go/glm-5.3#max
arena runners: opencode-go/deepseek-v4.1-flash#high, opencode-go/muse-spark-1.3-contributor#high
arena cross-judge pool: opencode-go/glm-5.3#max, opencode-go/kimi-k2.7-code#max
swarm workers: opencode-go/deepseek-v4.1-flash#high
architect runners: opencode-go/deepseek-v4.1-flash#high
interrogate reviewers: opencode-go/glm-5.3#max, opencode-go/muse-spark-1.3-contributor#high
