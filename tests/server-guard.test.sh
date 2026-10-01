#!/usr/bin/env bash
# Runs tools/proposed-server-guard.sql against a throwaway local Postgres
# (14+) shaped like the Supabase app_data table, and replays the exact SQL a
# v69 upsert and a v70 compare-and-swap produce through PostgREST.
# Nothing here touches Supabase. Needs initdb/pg_ctl/psql on PATH or in
# /usr/lib/postgresql/*/bin. Run: bash tests/server-guard.test.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; SQL="$HERE/../tools/proposed-server-guard.sql"
BIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")"
DIR="$(mktemp -d)"; PORT=$((20000 + RANDOM % 20000))
AS=(); if [ "$(id -u)" = 0 ]; then chown -R postgres "$DIR"; AS=(runuser -u postgres --); fi
cleanup(){ "${AS[@]}" "$BIN/pg_ctl" -D "$DIR/db" -m immediate stop >/dev/null 2>&1; rm -rf "$DIR"; }
trap cleanup EXIT
"${AS[@]}" "$BIN/initdb" -D "$DIR/db" -A trust -U postgres >/dev/null || exit 1
"${AS[@]}" "$BIN/pg_ctl" -D "$DIR/db" -o "-k $DIR -p $PORT -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null || { cat "$DIR/log"; exit 1; }
q(){ "${AS[@]}" psql -X -q -t -A -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=0 -c "$1" 2>&1; }
pass=0; fail=0
check(){ if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  PASS  $1   got=$2"; else fail=$((fail+1)); echo "  FAIL  $1   got=$2  want=$3"; fi; }

# Minimal Supabase stand-in: auth.uid() and the app_data table as the app uses it.
q "create schema auth; create function auth.uid() returns uuid language sql as \$\$ select '00000000-0000-0000-0000-0000000000a1'::uuid \$\$;
   create table public.app_data(user_id uuid not null, data_key text not null, data_value jsonb, updated_at timestamptz default now(), primary key(user_id,data_key));
   insert into public.app_data values ('00000000-0000-0000-0000-0000000000a1','bs_state','{\"testPaid\":300}','2026-09-30T20:00:00Z'),
                                      ('00000000-0000-0000-0000-0000000000a1','other_key','{\"x\":1}','2026-09-30T20:00:00Z');" >/dev/null

echo "Apply the proposed guard"
out=$("${AS[@]}" psql -X -q -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$SQL" 2>&1); check "guard SQL applies cleanly" "$?" "0"; [ -n "$out" ] && echo "$out"
U="'00000000-0000-0000-0000-0000000000a1'"
paid(){ q "select data_value->>'testPaid' from app_data where user_id=$U and data_key='bs_state'"; }
rev(){ q "select revision from app_data where user_id=$U and data_key='bs_state'"; }
check "existing row starts at revision 0" "$(rev)" "0"

echo "v69 upsert (PostgREST merge-duplicates), stale copy carrying _syncProtocol 2"
r=$(q "insert into app_data(user_id,data_key,data_value,updated_at) values ($U,'bs_state','{\"testPaid\":100,\"_syncProtocol\":2}',now())
       on conflict (user_id,data_key) do update set user_id=excluded.user_id,data_key=excluded.data_key,data_value=excluded.data_value,updated_at=excluded.updated_at")
check "v69 upsert refused" "$(echo "$r" | grep -c 'revision 1')" "1"
check "cloud keeps 300" "$(paid)" "300"

echo "Plain UPDATE without revision (Phase 2B / any old writer)"
r=$(q "update app_data set data_value='{\"testPaid\":100}', updated_at=now() where user_id=$U and data_key='bs_state'")
check "update without revision bump refused" "$(echo "$r" | grep -c 'revision must be exactly 1')" "1"
check "cloud keeps 300" "$(paid)" "300"

echo "v70 compare-and-swap: revision 0 -> 1, filtered on the revision it read"
TOK=$(q "select updated_at from app_data where user_id=$U and data_key='bs_state'")
r=$(q "update app_data set data_value='{\"testPaid\":350}', updated_at=now(), revision=1 where user_id=$U and data_key='bs_state' and updated_at='$TOK' and revision=0 returning revision")
check "v70 write lands at revision 1" "$r" "1"
check "cloud now 350" "$(paid)" "350"
check "replaced version kept in history" "$(q "select data_value->>'testPaid'||'@'||revision from app_data_history order by id desc limit 1")" "300@0"

echo "Second device still holding revision 0 tries the same CAS"
r=$(q "update app_data set data_value='{\"testPaid\":1}', updated_at=now(), revision=1 where user_id=$U and data_key='bs_state' and revision=0 returning revision")
check "stale CAS matches zero rows" "$r" ""
check "cloud keeps 350" "$(paid)" "350"

echo "Skipping a revision"
r=$(q "update app_data set data_value='{\"testPaid\":1}', revision=5 where user_id=$U and data_key='bs_state'")
check "revision jump refused" "$(echo "$r" | grep -c 'revision must be exactly 2')" "1"

echo "Delete and key changes"
r=$(q "delete from app_data where user_id=$U and data_key='bs_state'")
check "delete refused" "$(echo "$r" | grep -c 'not allowed')" "1"
check "row still there" "$(paid)" "350"
r=$(q "update app_data set data_key='x', revision=2 where user_id=$U and data_key='bs_state'")
check "data_key change refused" "$(echo "$r" | grep -c 'cannot change')" "1"

echo "Brand-new account"
U2="'00000000-0000-0000-0000-0000000000b2'"
r=$(q "insert into app_data(user_id,data_key,data_value) values ($U2,'bs_state','{}')")
check "v69-style first insert (no revision) refused" "$(echo "$r" | grep -c 'revision 1')" "1"
r=$(q "insert into app_data(user_id,data_key,data_value,revision) values ($U2,'bs_state','{}',1) returning revision")
check "v70 first insert at revision 1 accepted" "$r" "1"

echo "Other data_keys are untouched"
r=$(q "insert into app_data(user_id,data_key,data_value) values ($U,'other_key','{\"x\":2}') on conflict (user_id,data_key) do update set data_value=excluded.data_value returning data_value->>'x'")
check "non-bs_state upsert still works" "$r" "2"

echo "History is readable, not writable, by the owner role (Supabase-style broad grants; RLS must be what stops it)"
q "create role authenticated; grant usage on schema public, auth to authenticated; grant select, insert, update, delete on app_data_history to authenticated; grant execute on function auth.uid() to authenticated; grant usage on sequence app_data_history_id_seq to authenticated;" >/dev/null
r=$(q "set role authenticated; insert into app_data_history(user_id,data_key,op) values ($U,'bs_state','forged')")
echo "    forge attempt said: $r"; check "client cannot forge history" "$(echo "$r" | grep -c "row-level security")" "1"
r=$(q "set role authenticated; select count(*) from app_data_history")
check "owner reads own history" "$r" "1"
q "grant select, insert, update on app_data to authenticated;" >/dev/null
r=$(q "set role authenticated; update app_data set data_value='{\"testPaid\":360}', updated_at=now(), revision=2 where user_id=$U and data_key='bs_state' and revision=1 returning revision")
check "v70 save as the signed-in role lands at revision 2" "$r" "2"
r=$(q "set role authenticated; select count(*) from app_data_history")
check "its history copy was written through the guard (owner sees 2)" "$r" "2"

echo; if [ $fail = 0 ]; then echo "ALL $pass CHECKS PASS"; exit 0; else echo "FAILED $fail of $((pass+fail))"; exit 1; fi
