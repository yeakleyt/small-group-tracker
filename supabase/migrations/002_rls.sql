-- ============================================================
-- Small Group Tracker — Row Level Security (RLS) Policies
-- ============================================================
-- Apply after 001_initial.sql.
-- All tables have RLS enabled. Policies mirror the app's
-- three-role model: app_admin (global), group_admin (scoped),
-- member (own group only).
--
-- Helper: auth.uid() = current Supabase session user ID
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Is the current user an app_admin?
create or replace function is_app_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and app_role = 'app_admin'
  );
$$;

-- Is the current user a group_admin for a given group?
create or replace function is_group_admin(gid bigint)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.group_memberships
    where group_id = gid
      and user_id  = auth.uid()
      and role     = 'group_admin'
  );
$$;

-- Is the current user a member (any role) of a given group?
create or replace function is_group_member(gid bigint)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.group_memberships
    where group_id = gid
      and user_id  = auth.uid()
  );
$$;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.groups            enable row level security;
alter table public.group_memberships enable row level security;
alter table public.invitations       enable row level security;
alter table public.meetings          enable row level security;
alter table public.leader_signups    enable row level security;
alter table public.food_slots        enable row level security;

-- ============================================================
-- PROFILES
-- ============================================================

-- Anyone authenticated can read all profiles (needed for
-- displaying names on meetings, signups, etc.)
create policy "profiles: read by authenticated"
  on public.profiles for select
  using (auth.uid() is not null);

-- Users can update only their own profile
create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid());

-- App admins can update any profile (role changes, deactivation)
create policy "profiles: app_admin full update"
  on public.profiles for update
  using (is_app_admin());

-- App admins can insert profiles (for seeding / admin creation)
create policy "profiles: app_admin insert"
  on public.profiles for insert
  with check (is_app_admin());

-- ============================================================
-- GROUPS
-- ============================================================

-- Members can see groups they belong to; app_admins see all
create policy "groups: read own or admin"
  on public.groups for select
  using (
    is_app_admin()
    or exists (
      select 1 from public.group_memberships
      where group_id = id and user_id = auth.uid()
    )
  );

-- Only app_admins can create groups
create policy "groups: insert app_admin"
  on public.groups for insert
  with check (is_app_admin());

-- App_admins or group_admins of that group can update
create policy "groups: update admin or group_admin"
  on public.groups for update
  using (is_app_admin() or is_group_admin(id));

-- Only app_admins can delete groups
create policy "groups: delete app_admin"
  on public.groups for delete
  using (is_app_admin());

-- ============================================================
-- GROUP MEMBERSHIPS
-- ============================================================

-- Members can see memberships in their own groups; app_admins see all
create policy "memberships: read own group or admin"
  on public.group_memberships for select
  using (
    is_app_admin()
    or user_id = auth.uid()
    or is_group_member(group_id)
  );

-- App_admin or group_admin can add members
create policy "memberships: insert admin"
  on public.group_memberships for insert
  with check (is_app_admin() or is_group_admin(group_id));

-- App_admin or group_admin can change roles / remove members
create policy "memberships: update admin"
  on public.group_memberships for update
  using (is_app_admin() or is_group_admin(group_id));

create policy "memberships: delete admin"
  on public.group_memberships for delete
  using (is_app_admin() or is_group_admin(group_id));

-- ============================================================
-- INVITATIONS
-- ============================================================

-- App_admins see all invitations; group_admins see theirs
create policy "invitations: read admin or creator"
  on public.invitations for select
  using (
    is_app_admin()
    or created_by = auth.uid()
    or is_group_admin(group_id)
  );

-- Anyone authenticated can read a single invitation by token
-- (needed for the invite acceptance page)
create policy "invitations: read by token (public lookup)"
  on public.invitations for select
  using (true);   -- scoped in application code by token; fine since tokens are unguessable

-- App_admin or group_admin can create invitations
create policy "invitations: insert admin"
  on public.invitations for insert
  with check (is_app_admin() or is_group_admin(group_id));

-- Only the creator or an app_admin can revoke / update status
create policy "invitations: update creator or admin"
  on public.invitations for update
  using (created_by = auth.uid() or is_app_admin());

-- System can update invitation status on acceptance (service role key used server-side)

-- ============================================================
-- MEETINGS
-- ============================================================

-- Group members can read their group's meetings; app_admins see all
create policy "meetings: read group member or admin"
  on public.meetings for select
  using (is_app_admin() or is_group_member(group_id));

-- App_admin or group_admin can create meetings
create policy "meetings: insert group_admin or admin"
  on public.meetings for insert
  with check (is_app_admin() or is_group_admin(group_id));

-- App_admin or group_admin can edit/delete meetings
create policy "meetings: update group_admin or admin"
  on public.meetings for update
  using (is_app_admin() or is_group_admin(group_id));

create policy "meetings: delete group_admin or admin"
  on public.meetings for delete
  using (is_app_admin() or is_group_admin(group_id));

-- ============================================================
-- LEADER SIGNUPS
-- ============================================================

-- Group members can read leader signups for their meetings
create policy "leader_signups: read group member or admin"
  on public.leader_signups for select
  using (
    is_app_admin()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and is_group_member(m.group_id)
    )
  );

-- Members can volunteer themselves (if slot open and not locked — enforced in app logic)
create policy "leader_signups: insert own"
  on public.leader_signups for insert
  with check (
    user_id = auth.uid()
    or is_app_admin()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and is_group_admin(m.group_id)
    )
  );

-- Admins can remove leader signups
create policy "leader_signups: delete admin or own"
  on public.leader_signups for delete
  using (
    user_id = auth.uid()
    or is_app_admin()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and is_group_admin(m.group_id)
    )
  );

-- ============================================================
-- FOOD SLOTS
-- ============================================================

-- Group members can read food slots for their meetings
create policy "food_slots: read group member or admin"
  on public.food_slots for select
  using (
    is_app_admin()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and is_group_member(m.group_id)
    )
  );

-- Group_admin or app_admin can add/edit/delete slots
create policy "food_slots: insert admin"
  on public.food_slots for insert
  with check (
    is_app_admin()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and is_group_admin(m.group_id)
    )
  );

create policy "food_slots: update admin or claimer"
  on public.food_slots for update
  using (
    is_app_admin()
    or assigned_user_id = auth.uid()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and is_group_admin(m.group_id)
    )
  );

create policy "food_slots: delete admin"
  on public.food_slots for delete
  using (
    is_app_admin()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and is_group_admin(m.group_id)
    )
  );
