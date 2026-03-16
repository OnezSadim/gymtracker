-- GymTracker Supabase Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension (usually already enabled)
create extension if not exists "pgcrypto";

-- ── Profiles ──────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Workouts ──────────────────────────────────────────────────────────────────
create table if not exists public.workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_seconds integer,
  notes text,
  created_at timestamptz default now()
);

-- ── Exercises ─────────────────────────────────────────────────────────────────
create table if not exists public.exercises (
  id uuid default gen_random_uuid() primary key,
  workout_id uuid references public.workouts(id) on delete cascade not null,
  name text not null,
  order_index integer not null default 0,
  superset_group text,
  created_at timestamptz default now()
);

-- ── Sets ──────────────────────────────────────────────────────────────────────
create table if not exists public.sets (
  id uuid default gen_random_uuid() primary key,
  exercise_id uuid references public.exercises(id) on delete cascade not null,
  set_number integer not null,
  reps text,
  weight text,
  set_type text default 'normal' check (set_type in ('normal', 'warmup', 'dropset', 'failure')),
  logged_at timestamptz,
  created_at timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.sets enable row level security;

-- Profiles: users can read/write their own
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Workouts: users can CRUD their own
create policy "Users can view own workouts" on public.workouts
  for select using (auth.uid() = user_id);

create policy "Users can insert own workouts" on public.workouts
  for insert with check (auth.uid() = user_id);

create policy "Users can update own workouts" on public.workouts
  for update using (auth.uid() = user_id);

create policy "Users can delete own workouts" on public.workouts
  for delete using (auth.uid() = user_id);

-- Exercises: accessible if the parent workout belongs to user
create policy "Users can view own exercises" on public.exercises
  for select using (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

create policy "Users can insert own exercises" on public.exercises
  for insert with check (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

create policy "Users can delete own exercises" on public.exercises
  for delete using (
    exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

-- Sets: accessible if grandparent workout belongs to user
create policy "Users can view own sets" on public.sets
  for select using (
    exists (
      select 1 from public.exercises e
      join public.workouts w on w.id = e.workout_id
      where e.id = exercise_id and w.user_id = auth.uid()
    )
  );

create policy "Users can insert own sets" on public.sets
  for insert with check (
    exists (
      select 1 from public.exercises e
      join public.workouts w on w.id = e.workout_id
      where e.id = exercise_id and w.user_id = auth.uid()
    )
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_workouts_user_id on public.workouts(user_id);
create index if not exists idx_workouts_started_at on public.workouts(started_at desc);
create index if not exists idx_exercises_workout_id on public.exercises(workout_id);
create index if not exists idx_sets_exercise_id on public.sets(exercise_id);
