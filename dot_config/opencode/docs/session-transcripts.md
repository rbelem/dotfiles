# Session transcripts

OpenCode stores every session in SQLite. The path, the schema, and the
working query — for retrospectives, session mining, and the `retro` and
`research` skills.

## Where

```text
~/.local/share/opencode/opencode.db
```

Table `session_message` holds one row per message. `data` is JSON:

```json
{ "agent": "orchestrator", "model": {...}, "content": [ { "type": "tool", "tool": "shell", "state": {...} } ] }
```

Two traps:

- The `part` table looks like the natural place to look and is **legacy** —
  it is empty for v2 sessions. Join through `session_message` instead.
- `session` holds old sessions; the live index is `session_v2`.

A third trap, the one that bites hardest: **v2 tool parts do not use the v1
shape.** A v2 tool part is

```json
{ "type": "tool", "name": "shell", "state": { "status": "completed", "input": { "command": "..." }, "content": [ { "type": "text", "text": "..." } ], "metadata": {} } }
```

so the tool name is `$.name` (not `$.tool`) and the output lives in
`$.state.content` (not `$.state.output`). Querying the v1 names against a v2
session does not error — it returns **empty strings and zero bytes for every
row**, which reads like "this session did nothing". The script queries both
shapes so it works on either.

## The script

```bash
~/.config/opencode/scripts/session-transcript.sh <session-id> [text|tool|all]
```

It prints one line per message part: timestamp, kind, tool, output size, and
a snippet of the input. `tool` mode is the useful one for a retrospective —
it shows every call the agent made and how big each answer was.

## Finding a session id

```bash
sqlite3 ~/.local/share/opencode/opencode.db \
  "select id, title from session_v2 order by rowid desc limit 10;"
```

`session_v2` rows are ordered by insertion, so the newest session is last in
`rowid` order. Titles are set by the title agent and are descriptive.

## The raw query

```sql
select m.time_created,
       json_extract(c.value,'$.type') as kind,
       coalesce(json_extract(c.value,'$.name'), json_extract(c.value,'$.tool'),'') as tool,
       length(coalesce(json_extract(c.value,'$.state.content'), json_extract(c.value,'$.state.output'), json_extract(c.value,'$.text'),'')) as bytes,
       substr(replace(replace(coalesce(
         json_extract(c.value,'$.state.input.command'),
         json_extract(c.value,'$.state.input.function'),
         json_extract(c.value,'$.state.input.filePath'),
         json_extract(c.value,'$.state.input.url'),
         json_extract(c.value,'$.state.input.code'),
         json_extract(c.value,'$.text'),
         json_extract(c.value,'$.state.input.prompt'),
         ''), char(10), ' '), char(13), ' '), 1, 160) as snippet
from session_message m, json_each(json_extract(m.data,'$.content')) c
where m.session_id = '<session-id>'
  and json_extract(c.value,'$.type') in ('tool','text','reasoning')
order by m.time_created;
```

`bytes` is the output size of each call — the fastest way to spot the
expensive calls in a session. It reads `$.state.content` (v2) and falls back
to `$.state.output` (v1); against a v2 session the v1 name alone yields 0 for
every row, so check the `tool` column is populated before trusting `bytes`.

## Tool output on disk

Large tool results are also written to files under
`~/.local/share/opencode/tool-output/`, and session diffs under
`~/.local/share/opencode/storage/session_diff/`. The database keeps the
transcript; the files keep the bulky output.
