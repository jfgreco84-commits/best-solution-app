-- ============================================================================
-- Best Solution: PROPOSED server-side guard for app_data 'bs_state'
-- STATUS: PROPOSAL ONLY. NOT APPLIED. Do not run without Justin's approval.
-- ============================================================================
-- Why: old app tabs (v69 and earlier) save with an unconditional upsert. No
-- client-side change can stop a tab that is already open, and a document
-- stamp (_syncProtocol) does not help: v69 keeps whatever stamp the document
-- already carries. Only the server can refuse those writes.
--
-- What it does (bs_state rows only; other data_keys untouched):
--   * adds app_data.revision (existing rows start at 0);
--   * BEFORE INSERT: a new bs_state row must carry revision = 1.
--     Postgres fires BEFORE INSERT for every proposed row of
--     INSERT ... ON CONFLICT DO UPDATE, which is what a v69 upsert is, and v69
--     never sends a revision (column default 0), so every v69 save is refused
--     whether or not the row exists;
--   * BEFORE UPDATE: revision must be exactly the stored revision + 1, user_id
--     and data_key may not change. v70 sends revision+1 and also filters on the
--     revision it read (compare-and-swap), so two v70 devices cannot both win;
--   * every replaced or deleted version is copied to app_data_history first;
--   * DELETE of a bs_state row is refused.
-- Phase 2B (Cloud Reconciliation) does not send a revision, so it is refused
-- too. It is a finished one-time tool.
--
-- Before applying, run this READ-ONLY check and confirm the column types match
-- the assumptions (user_id uuid, data_key text, data_value json/jsonb,
-- updated_at timestamptz):
--   select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='app_data' order by ordinal_position;
--
-- Rollback (keeps the history table and the revision column):
--   drop trigger if exists app_data_bs_guard_ins on public.app_data;
--   drop trigger if exists app_data_bs_guard_upd on public.app_data;
--   drop trigger if exists app_data_bs_guard_del on public.app_data;
-- After a rollback, v69 tabs can overwrite again.
-- ============================================================================
begin;

alter table public.app_data add column if not exists revision bigint not null default 0;

create table if not exists public.app_data_history (
  id           bigserial primary key,
  user_id      uuid        not null,
  data_key     text        not null,
  data_value   jsonb,
  updated_at   timestamptz,
  revision     bigint,
  op           text        not null,
  replaced_at  timestamptz not null default now()
);
alter table public.app_data_history enable row level security;
drop policy if exists app_data_history_owner_read on public.app_data_history;
create policy app_data_history_owner_read on public.app_data_history
  for select using (auth.uid() = user_id);
-- No insert/update/delete policies: clients can read their own history only.

create or replace function public.app_data_bs_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.data_key = 'bs_state' and new.revision is distinct from 1 then
      raise exception 'bs_state: a new row must start at revision 1 (old app version?)'
        using errcode = 'P0001';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.data_key = 'bs_state' or new.data_key = 'bs_state' then
      if new.data_key is distinct from old.data_key or new.user_id is distinct from old.user_id then
        raise exception 'bs_state: user_id and data_key cannot change' using errcode = 'P0001';
      end if;
      if new.revision is distinct from old.revision + 1 then
        raise exception 'bs_state: revision must be exactly % (got %) (old app version or stale copy)',
          old.revision + 1, new.revision using errcode = 'P0001';
      end if;
      insert into public.app_data_history(user_id, data_key, data_value, updated_at, revision, op)
        values (old.user_id, old.data_key, old.data_value::jsonb, old.updated_at, old.revision, 'update');
    end if;
    return new;
  else -- DELETE
    if old.data_key = 'bs_state' then
      insert into public.app_data_history(user_id, data_key, data_value, updated_at, revision, op)
        values (old.user_id, old.data_key, old.data_value::jsonb, old.updated_at, old.revision, 'delete');
      raise exception 'bs_state: deleting the app data row is not allowed' using errcode = 'P0001';
    end if;
    return old;
  end if;
end $$;

drop trigger if exists app_data_bs_guard_ins on public.app_data;
drop trigger if exists app_data_bs_guard_upd on public.app_data;
drop trigger if exists app_data_bs_guard_del on public.app_data;
create trigger app_data_bs_guard_ins before insert on public.app_data
  for each row execute function public.app_data_bs_guard();
create trigger app_data_bs_guard_upd before update on public.app_data
  for each row execute function public.app_data_bs_guard();
create trigger app_data_bs_guard_del before delete on public.app_data
  for each row execute function public.app_data_bs_guard();

commit;
