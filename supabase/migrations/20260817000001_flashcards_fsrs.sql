-- Korean Flashcards: profiles, FSRS review states, answer logs.
-- Disable "Confirm email" in Auth settings for instant signup sessions.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  username_normalized text not null unique,
  progress_migrated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_username_normalized text;
begin
  v_username := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1));
  v_username_normalized := coalesce(
    new.raw_user_meta_data ->> 'username_normalized',
    lower(trim(v_username))
  );

  insert into public.profiles (user_id, username, username_normalized)
  values (new.id, v_username, v_username_normalized)
  on conflict (user_id) do update
    set username = excluded.username,
        username_normalized = excluded.username_normalized,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.review_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_type text not null,
  item_id text not null,
  due_at timestamptz not null,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  scheduled_days integer not null default 0,
  elapsed_days integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  learning_steps integer not null default 0,
  fsrs_state integer not null default 0,
  last_review_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, item_type, item_id)
);

create index if not exists review_states_user_type_due_idx
  on public.review_states (user_id, item_type, due_at);

drop trigger if exists review_states_set_updated_at on public.review_states;
create trigger review_states_set_updated_at
before update on public.review_states
for each row execute function public.set_updated_at();

create table if not exists public.review_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_type text not null,
  item_id text not null,
  rating smallint not null,
  correct boolean not null,
  context text,
  response_ms integer,
  reviewed_at timestamptz not null default timezone('utc', now()),
  previous_state jsonb,
  next_state jsonb
);

create index if not exists review_logs_user_reviewed_idx
  on public.review_logs (user_id, reviewed_at desc);

alter table public.profiles enable row level security;
alter table public.review_states enable row level security;
alter table public.review_logs enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists review_states_select_own on public.review_states;
create policy review_states_select_own on public.review_states
  for select using (auth.uid() = user_id);

drop policy if exists review_states_insert_own on public.review_states;
create policy review_states_insert_own on public.review_states
  for insert with check (auth.uid() = user_id);

drop policy if exists review_states_update_own on public.review_states;
create policy review_states_update_own on public.review_states
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists review_states_delete_own on public.review_states;
create policy review_states_delete_own on public.review_states
  for delete using (auth.uid() = user_id);

drop policy if exists review_logs_select_own on public.review_logs;
create policy review_logs_select_own on public.review_logs
  for select using (auth.uid() = user_id);

drop policy if exists review_logs_insert_own on public.review_logs;
create policy review_logs_insert_own on public.review_logs
  for insert with check (auth.uid() = user_id);
