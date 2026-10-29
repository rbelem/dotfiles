#!/usr/bin/env bash
# Print a readable transcript of one opencode session.
#
# Usage: scripts/session-transcript.sh <session-id> [text|tool|all] [--full]
#
# --full widens the snippet column from 160 to 2000 chars for retrospectives.
#
# Sessions live in ~/.local/share/opencode/opencode.db, table session_message
# (one row per message, data = JSON with a content[] array). The `part`
# table is legacy: it is empty for v2 sessions, so join through
# session_message instead.
#
# Session ids: sqlite3 ~/.local/share/opencode/opencode.db \
#   "select id, title from session_v2 order by rowid desc limit 10;"

set -uo pipefail

DB="${OPENCODE_DB:-$HOME/.local/share/opencode/opencode.db}"

if [ "$#" -lt 1 ]; then
  echo "usage: $(basename "$0") <session-id> [text|tool|all]" >&2
  exit 2
fi

SESSION_ID=$1
MODE=${2:-all}
FULL=0
if [ "$MODE" = "--full" ]; then MODE=all; FULL=1; elif [ "${3:-}" = "--full" ]; then FULL=1; fi
SNIPPET_LEN=160
if [ "$FULL" = 1 ]; then SNIPPET_LEN=2000; fi

if [ ! -f "$DB" ]; then
  echo "session-transcript: database not found: $DB" >&2
  exit 1
fi

case "$MODE" in
  text) TYPES="'text'" ;;
  tool) TYPES="'tool'" ;;
  all)  TYPES="'tool','text','reasoning'" ;;
  *)    echo "session-transcript: mode must be text, tool, or all" >&2; exit 2 ;;
esac

sqlite3 -separator ' | ' "$DB" "
select m.time_created,
       json_extract(c.value,'\$.type') as kind,
       coalesce(json_extract(c.value,'\$.name'), json_extract(c.value,'\$.tool'),'') as tool,
       length(coalesce(json_extract(c.value,'\$.state.content'), json_extract(c.value,'\$.state.output'), json_extract(c.value,'\$.text'),'')) as bytes,
       substr(replace(replace(coalesce(
         json_extract(c.value,'\$.state.input.command'),
         json_extract(c.value,'\$.state.input.function'),
         json_extract(c.value,'\$.state.input.filePath'),
         json_extract(c.value,'\$.state.input.path'),
         json_extract(c.value,'\$.state.input.url'),
         json_extract(c.value,'\$.state.input.code'),
         json_extract(c.value,'\$.text'),
         json_extract(c.value,'\$.state.input.prompt'),
         ''), char(10), ' '), char(13), ' '), 1, $SNIPPET_LEN) as snippet
from session_message m, json_each(json_extract(m.data,'\$.content')) c
where m.session_id = '$SESSION_ID'
  and json_extract(c.value,'\$.type') in ($TYPES)
order by m.time_created;"
