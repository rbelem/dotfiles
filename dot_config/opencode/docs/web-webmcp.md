# WebMCP (page tools for in-browser agents)

A page can declare structured tools on `document.modelContext` so an
in-browser AI agent calls app logic instead of scraping the DOM. Tools only —
no Resources, no Prompts. Not a backend MCP server.

| Need | Where |
|---|---|
| Design, schema, annotations, evals, audit | upstream `build-webmcp-tools` skill in `~/.agents/skills/build-webmcp-tools` (skills CLI, locked) |
| This machine's browser + MCP facts, local verification | `webmcp` skill in `~/Workspace/github.com/rbelem/skills/webmcp/` |

Read the upstream skill's `references/` before designing tools. It is the
authority on budgets, naming, annotations, and the audit checklist.

## Browser status on this box (2026-10-19)

| Browser | Version | `document.modelContext` |
|---|---|---|
| flatpak Google Chrome | 155.0.8059.39 | absent |
| nix `chromium` | 152.0.7977.64 | absent |

Chrome exposes the API only behind `chrome://flags/#enable-webmcp-testing`
(blink runtime feature `WebMCP`, overridable through the `WebMCP` base
feature), and the API is origin-trial gated. Probed headless and headed with
`--enable-features=WebMCP` and `--enable-blink-features=WebMCP` over CDP
`Runtime.evaluate`.

Local verification therefore runs against the polyfill:
`https://raw.githubusercontent.com/GoogleChromeLabs/webmcp-tools/main/demos/shared/webmcp-polyfill.js`

## Types

`npm i -D webmcp-types` (0.1.10, TypeScript 5.0+). Wire with
`"types": ["webmcp-types"]` in tsconfig — append it, replacing the array
drops `@types/node` — or `/// <reference types="webmcp-types" />`.
`ModelContextToolFromSchema<T>` infers the `execute` argument from
`inputSchema`.

## Sources

- Spec: https://github.com/webmachinelearning/webmcp
- Types: https://github.com/webmachinelearning/webmcp-types
- Chrome skill, polyfill, demos: https://github.com/GoogleChromeLabs/webmcp-tools
- Dev guide: https://developer.chrome.com/docs/ai/webmcp
