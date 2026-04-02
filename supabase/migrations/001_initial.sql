-- ============================================================
-- Small Group Tracker — Initial Schema
-- Supabase / PostgreSQL migration
-- ============================================================
-- Run this in the Supabase SQL Editor or via:
--   supabase db push
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- TYPES / ENUMS
-- ============================================================

create type app_role as enum ('app_admin', 'member');
create type group_role as enum ('group_admin', 'member');
create type invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');

-- ============================================================
-- USERS / PROFILES
-- ============================================================
-- Extends Supabase Auth (auth.users) with app-level profile data.
-- Row is created automatically via a trigger when a user signs up
-- via the invitation flow (see invite acceptance function below).

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  first_name   text not null default '',
  last_name    text not null default '',
  app_role     app_role not null default 'member',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index idx_profiles_email on public.profiles(email);
create index idx_profiles_app_role on public.profiles(app_role);

-- ============================================================
-- GROUPS
-- ============================================================

create table public.groups (
  id            bigserial primary key,
  name          text not null,
  description   text not null default '',
  location      text not null default '',
  meeting_day   text not null default '',
  meeting_time  text not null default '',
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now()
);

create index idx_groups_archived on public.groups(is_archived);

-- ============================================================
-- GROUP MEMBERSHIPS
-- ============================================================

create table public.group_memberships (
  id         bigserial primary key,
  group_id   bigint not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       group_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index idx_memberships_group on public.group_memberships(group_id);
create index idx_memberships_user  on public.group_memberships(user_id);

-- ============================================================
-- INVITATIONS
-- ============================================================

create table public.invitations (
  id           bigserial primary key,
  token        text not null unique,               -- nanoid(32), single-use
  email        text,                                -- optional pre-fill
  group_id     bigint references public.groups(id) on delete cascade,
  group_role   group_role not null default 'member',
  created_by   uuid not null references public.profiles(id),
  status       invitation_status not null default 'pending',
  expires_at   timestamptz not null,
  accepted_by  uuid references public.profiles(id),
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index idx_invitations_token      on public.invitations(token);
create index idx_invitations_created_by on public.invitations(created_by);
create index idx_invitations_group      on public.invitations(group_id);
create index idx_invitations_status     on public.invitations(status);

-- ============================================================
-- MEETINGS
-- ============================================================

create table public.meetings (
  id                bigserial primary key,
  group_id          bigint not null references public.groups(id) on delete cascade,
  title             text not null,
  date              date not null,
  start_time        text not null,   -- "HH:MM" 24h
  end_time          text not null,   -- "HH:MM" 24h
  location          text not null default '',
  notes             text,
  host_user_id      uuid references public.profiles(id) on delete set null,
  is_leader_locked  boolean not null default false,
  created_at        timestamptz not null default now()
);

create index idx_meetings_group on public.meetings(group_id);
create index idx_meetings_date  on public.meetings(date);

-- ============================================================
-- LEADER SIGNUPS
-- ============================================================

create table public.leader_signups (
  id                  bigserial primary key,
  meeting_id          bigint not null references public.meetings(id) on delete cascade unique,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  assigned_by_admin   uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index idx_leader_signups_meeting on public.leader_signups(meeting_id);
create index idx_leader_signups_user    on public.leader_signups(user_id);

-- ============================================================
-- FOOD SLOTS
-- ============================================================

create table public.food_slots (
  id               bigserial primary key,
  meeting_id       bigint not null references public.meetings(id) on delete cascade,
  label            text not null,   -- e.g. "Main Dish", "Dessert"
  assigned_user_id uuid references public.profiles(id) on delete set null,
  is_locked        boolean not null default false,
  created_at       timestamptz not null default now()
);

create index idx_food_slots_meeting on public.food_slots(meeting_id);
create index idx_food_slots_user    on public.food_slots(assigned_user_id);
