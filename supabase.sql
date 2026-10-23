-- =====================================================================
-- دوري توقعات البلوز — قاعدة البيانات
-- الصق هذا الملف كاملا في Supabase > SQL Editor ثم اضغط Run.
-- آمن للتشغيل أكثر من مرة.
-- =====================================================================

-- ---------- الجداول ----------
create table if not exists public.docs (
  path        text primary key,
  col         text not null,
  season_id   text,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
create index if not exists docs_col_idx on public.docs (col);

create table if not exists public.predictions (
  match_id   text not null,
  pid        text not null,
  season_id  text,
  ch         smallint not null check (ch between 0 and 30),
  op         smallint not null check (op between 0 and 30),
  scorer     text not null default '',
  late       boolean not null default false,
  source     text not null default 'admin',
  at         timestamptz not null default now(),
  primary key (match_id, pid)
);

create table if not exists public.match_locks (
  match_id   text primary key,
  season_id  text not null,
  lock_at    timestamptz not null,
  open       boolean not null default true
);

create table if not exists public.member_codes (
  pid        text primary key,
  code       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  uid        uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id         bigserial primary key,
  ts         timestamptz not null default now(),
  action     text not null,
  detail     jsonb,
  season_id  text,
  by_uid     uuid default auth.uid()
);
create index if not exists audit_ts_idx on public.audit_logs (ts desc);

-- ---------- تحديث وقت التعديل ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
  for each row execute function public.touch_updated_at();

-- ---------- الصلاحيات ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where uid = auth.uid());
$$;

-- أول حساب يستدعي هذه الدالة يصبح المدير. بعد ذلك لا يقبل أي حساب جديد.
create or replace function public.claim_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  lock table public.admins in exclusive mode;
  if exists (select 1 from public.admins where uid = auth.uid()) then return true; end if;
  if exists (select 1 from public.admins) then return false; end if;
  insert into public.admins (uid) values (auth.uid());
  return true;
end $$;

create or replace function public.admin_exists() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins);
$$;

alter table public.docs         enable row level security;
alter table public.predictions  enable row level security;
alter table public.match_locks  enable row level security;
alter table public.member_codes enable row level security;
alter table public.admins       enable row level security;
alter table public.audit_logs   enable row level security;

drop policy if exists docs_read on public.docs;
drop policy if exists docs_admin on public.docs;
create policy docs_read  on public.docs for select using (true);
create policy docs_admin on public.docs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- التوقعات لا تظهر للعامة إلا بعد إغلاق باب التوقع
drop policy if exists pred_read on public.predictions;
drop policy if exists pred_admin on public.predictions;
create policy pred_read on public.predictions for select using (
  public.is_admin() or exists (
    select 1 from public.match_locks l
    where l.match_id = predictions.match_id and l.lock_at <= now()
  )
);
create policy pred_admin on public.predictions for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists locks_read on public.match_locks;
drop policy if exists locks_admin on public.match_locks;
create policy locks_read  on public.match_locks for select using (true);
create policy locks_admin on public.match_locks for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists codes_admin on public.member_codes;
create policy codes_admin on public.member_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select to authenticated using (uid = auth.uid());

drop policy if exists audit_read on public.audit_logs;
drop policy if exists audit_write on public.audit_logs;
create policy audit_read  on public.audit_logs for select to authenticated using (public.is_admin());
create policy audit_write on public.audit_logs for insert to authenticated with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.docs, public.predictions, public.match_locks to anon, authenticated;
grant select, insert, update, delete on public.docs, public.predictions, public.match_locks, public.member_codes, public.audit_logs to authenticated;
grant select on public.admins to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- دوال الأعضاء (بالرمز الشخصي، دون حساب) ----------
create or replace function public.member_login(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select pid from public.member_codes where code = upper(btrim(p_code));
$$;

create or replace function public.member_predictions(p_code text)
returns table (match_id text, ch smallint, op smallint, scorer text, at timestamptz, source text)
language sql stable security definer set search_path = public as $$
  select p.match_id, p.ch, p.op, p.scorer, p.at, p.source
  from public.predictions p
  join public.member_codes c on c.pid = p.pid
  where c.code = upper(btrim(p_code));
$$;

create or replace function public.member_submit(p_code text, p_match text, p_ch int, p_op int, p_scorer text)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_pid  text;
  v_lock public.match_locks%rowtype;
  v_ok   boolean;
begin
  select pid into v_pid from public.member_codes where code = upper(btrim(p_code));
  if v_pid is null then raise exception 'invalid_code'; end if;

  select * into v_lock from public.match_locks where match_id = p_match;
  if not found then raise exception 'unknown_match'; end if;
  if not v_lock.open or v_lock.lock_at <= now() then raise exception 'locked'; end if;

  select exists (
    select 1 from public.docs d, jsonb_array_elements(d.data -> 'members') m
    where d.path = 'seasons/' || v_lock.season_id
      and m ->> 'pid' = v_pid
      and coalesce((m ->> 'active')::boolean, true)
  ) into v_ok;
  if not v_ok then raise exception 'not_member'; end if;

  if p_ch is null or p_op is null or p_ch not between 0 and 30 or p_op not between 0 and 30 then
    raise exception 'invalid_score';
  end if;

  insert into public.predictions (match_id, pid, season_id, ch, op, scorer, late, source, at)
  values (p_match, v_pid, v_lock.season_id, p_ch, p_op, left(coalesce(btrim(p_scorer), ''), 60), false, 'member', now())
  on conflict (match_id, pid) do update
    set ch = excluded.ch, op = excluded.op, scorer = excluded.scorer,
        late = false, source = 'member', at = now();
  return now();
end $$;

-- من قدم توقعه (الأسماء فقط دون المحتوى) لعرض "بانتظار توقعات"
create or replace function public.submitted_list(p_season text)
returns table (match_id text, pid text)
language sql stable security definer set search_path = public as $$
  select p.match_id, p.pid
  from public.predictions p
  join public.match_locks l on l.match_id = p.match_id
  where l.season_id = p_season;
$$;

revoke all on function public.claim_admin() from public;
grant execute on function public.claim_admin() to authenticated;
grant execute on function public.is_admin(), public.admin_exists(), public.member_login(text),
  public.member_predictions(text), public.member_submit(text, text, int, int, text),
  public.submitted_list(text) to anon, authenticated;

-- ---------- التحديث المباشر ----------
do $$
begin
  begin alter publication supabase_realtime add table public.docs; exception when others then null; end;
  begin alter publication supabase_realtime add table public.predictions; exception when others then null; end;
  begin alter publication supabase_realtime add table public.match_locks; exception when others then null; end;
end $$;
