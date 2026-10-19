# Web Intelligence (wigolo)

**wigolo is the default web backend.** It is the only web surface with a
cache: every result is stored under `~/.wigolo/`, so re-queries are instant
and free.

| Need | wigolo tool |
|---|---|
| Web search (multi-engine, ML reranked, explainable scoring) | `wigolo_search` |
| Fetch one URL → clean markdown (handles JS SPAs, anti-bot, PDFs) | `wigolo_fetch` |
| Crawl a site (BFS/DFS/sitemap/map-only) | `wigolo_crawl` |
| Structured data from a page (tables, JSON-LD, custom schema) | `wigolo_extract` |
| Query the local cache (keyword + semantic hybrid) | `wigolo_cache` |
| Pages similar to a URL or concept | `wigolo_find_similar` |
| Multi-step cited research brief | `wigolo_research` |
| Autonomous gather loop with output schema | `wigolo_agent` |
| Diff a page vs its cached copy | `wigolo_diff` |
| Watch a URL for changes (webhook delivery) | `wigolo_watch` |

The MCP daemon runs at `http://127.0.0.1:3333/mcp` (devbox global service,
`restart=always`). No API key is needed for the core tools; set
`WIGOLO_LLM_PROVIDER` + `GEMINI_API_KEY` only if you want
`wigolo_research` / `wigolo_agent` to synthesize cited answers.

The built-in `websearch` and `webfetch` tools both route through wigolo:
`plugins/wigolo-search.js` registers the `wigolo` search provider and
overrides the built-in `webfetch` tool with wigolo's `fetch` (cached,
JS-rendered, anti-bot). Permissions in `opencode.jsonc` allow both — keep it
that way, since plugin tools only honor deny rules.

**Other backends exist and are usable.** The `firecrawl-mcp` server is
enabled in `opencode.jsonc` (a remote server at
`https://mcp.firecrawl.dev/v2/mcp`), and `gh_grep` is a remote code-search
server. wigolo stays the default because it caches; firecrawl and gh_grep
answer what wigolo cannot. Check
`grep -n "firecrawl\|gh_grep" ~/.config/opencode/opencode.jsonc` for the
current set — the config is the authority, not this paragraph.

Skill packs (`wigolo-*` in `~/.agents/skills/`) provide per-tool usage
guidance; load them when you need flag-level detail for a specific tool.
