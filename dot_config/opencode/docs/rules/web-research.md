# Web research and fetches

## After a fetch

Quote the excerpt you rely on, then work from it. Do not re-quote whole pages
into the conversation.

## Tool order

- `wigolo` covers search, fetch, crawl, extraction, and a local cache. Check the
  cache before searching; prefer it over a bare fetch for a page you may need
  again.
- Browser automation (`agent-browser`, `browser-harness`) is for pages that need
  a logged-in session or JavaScript, not for public static content.
- Library and API questions: read the installed version's own type definitions
  or docs before trusting a blog post.

## Three sources that mislead

- **Chromium source**: grep.app does not index it. Fetch raw files from
  `raw.githubusercontent.com/chromium/chromium/main/<path>`.
- **grep.app is rate-limited**: `gh_grep` returns "Too Many Requests" under load.
  On a 429, fall back to the GitHub tree API plus `raw.githubusercontent.com`.
  Do not retry the MCP.
- **Skill registry**: `skills find <query>` and
  `https://skills.sh/api/search?q=<query>` list every published skill. Search
  there before hunting GitHub or npm.
