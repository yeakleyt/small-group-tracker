# Small Group Tracker

A production-ready web application for managing multiple small groups inside one shared app. Supports three role levels, invite-only membership, meeting management, and volunteer signups for both group leaders and food coordination.

Let the testing beging!

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Folder Structure](#folder-structure)
4. [Local Development](#local-development)
5. [Environment Variables](#environment-variables)
6. [Default Admin Account](#default-admin-account)
7. [Invitation Flow](#invitation-flow)
8. [Roles & Permissions](#roles--permissions)
9. [Supabase Migration (optional)](#supabase-migration-optional)
10. [Deployment](#deployment)

---

## Features

- **Invite-only** — no public self-signup; all users join via single-use time-limited tokens
- **Three roles:** App Administrator (global), Group Administrator (per-group), Member
- **Group management** — create, edit, archive groups; manage members and roles
- **Meeting management** — create/edit meetings with date, time, location, notes, optional host
- **Leader signup** — members volunteer; admins can override/lock/clear
- **Food signup** — per-meeting slots (Main Dish, Dessert, etc.); members claim open slots; admins manage
- **Calendar** — monthly grid + agenda view across all groups, with clickable meeting entries
- **Dashboard** — at-a-glance stats: upcoming meetings, open leader slots, open food slots
- **Admin panel** — app-admin views for all users and all groups

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Routing | Wouter (hash-based for deploy compatibility) |
| UI Components | shadcn/ui + Tailwind CSS v3 |
| State/Data | TanStack Query v5 |
| Backend | Express.js (Node.js) |
| Database | SQLite via Drizzle ORM + `better-sqlite3` |
| Auth | Express sessions + bcryptjs password hashing |
| Date handling | date-fns |
| Token generation | nanoid |

---

## Folder Structure

```
small-group-tracker/
├── client/
│   └── src/
│       ├── App.tsx                    # Router + AuthProvider + all routes
│       ├── index.css                  # Tailwind directives + indigo theme
│       ├── contexts/
│       │   └── AuthContext.tsx        # Auth context (login/logout/me)
│       ├── components/
│       │   └── layout/
│       │       └── AppLayout.tsx      # Sidebar layout with nav
│       ├── lib/
│       │   ├── queryClient.ts         # TanStack Query client (null on 401)
│       │   └── types.ts               # All TypeScript interfaces
│       └── pages/
│           ├── LoginPage.tsx
│           ├── InviteAcceptPage.tsx
│           ├── DashboardPage.tsx
│           ├── GroupsPage.tsx
│           ├── GroupDetailPage.tsx    # Meetings + Members tabs
│           ├── MeetingDetailPage.tsx  # Leader + food slot signups
│           ├── MeetingFormPage.tsx    # Create / edit meeting
│           ├── CalendarPage.tsx       # Monthly grid + agenda
│           ├── InvitationsPage.tsx    # Create + manage invitations
│           ├── ProfilePage.tsx        # Edit profile + change password
│           ├── AdminUsersPage.tsx     # App-admin: all users
│           └── AdminGroupsPage.tsx    # App-admin: all groups
├── server/
│   ├── index.ts                       # Express + session setup + seed admin
│   ├── routes.ts                      # All API routes (~600 lines)
│   └── storage.ts                     # SQLite storage class + IStorage interface
├── shared/
│   └── schema.ts                      # Drizzle ORM table definitions (shared)
├── supabase/
│   └── migrations/
│       ├── 001_initial.sql            # Supabase Postgres schema
│       └── 002_rls.sql                # Row Level Security policies
├── .env.example                       # Environment variable template
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── tsconfig.json
```

---

## Local Development

### Prerequisites

- Node.js 18+ and npm

### Setup

```bash
# 1. Clone or copy the project
cd small-group-tracker

# 2. Install dependencies
npm install

# 3. Copy the env file
cp .env.example .env
# Edit .env and change SESSION_SECRET to a random string

# 4. Start the dev server
npm run dev
```

The app starts on **http://localhost:5000**.

On first run, the default admin account is seeded automatically (see below).

### Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server (Express + Vite, port 5000) |
| `npm run build` | Production build (outputs to `dist/`) |
| `npm run check` | TypeScript type check |

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|---|---|---|
| `SESSION_SECRET` | `sgt-dev-secret-change-me` | Express session signing secret — **change in production** |
| `PORT` | `5000` | Port the server listens on |
| `NODE_ENV` | `development` | `development` or `production` |
| `SEED_ADMIN_EMAIL` | `admin@example.com` | Email for the seeded admin account |
| `SEED_ADMIN_PASSWORD` | `Admin1234!` | Password for the seeded admin account |
| `SEED_ADMIN_FIRST_NAME` | `App` | First name for the seeded admin |
| `SEED_ADMIN_LAST_NAME` | `Admin` | Last name for the seeded admin |

---

## Default Admin Account

On first startup, the server seeds a single App Administrator account:

| Field | Value |
|---|---|
| Email | `admin@example.com` |
| Password | `Admin1234!` |

**Change these credentials immediately after first login in production**, either via the Profile page (password) or by updating `.env` before first run.

---

## Invitation Flow

Public registration is disabled. All users must be invited:

1. An **App Admin** or **Group Admin** goes to **Invitations → New Invitation**
2. They choose a target group (optional — omitting creates an app-level invite)
3. A **single-use, 7-day token** link is generated: `https://your-app.com/#/invite/<token>`
4. The invitee clicks the link, sets their name and password, and is added to the app (and group if specified)
5. The token is marked `used` — it cannot be reused

Tokens are 32-character random strings generated with `nanoid`. Expired or revoked tokens display an error on the invite page.

---

## Roles & Permissions

### App Administrator (`app_admin`)
- Full access to everything in the app
- Can create/edit/archive any group
- Can invite users to any group or the app
- Can manage all users (role changes, deactivation)
- Can create/edit/delete any meeting

### Group Administrator (`group_admin`)
- Scoped to groups where they hold the `group_admin` membership role
- Can create/edit/delete meetings in their group
- Can invite members to their group
- Can manage membership roles within their group
- Can override/lock/clear leader signups
- Can add/edit/remove/reassign food slots

### Member
- Can view groups they belong to
- Can view and attend meetings in their groups
- Can volunteer for open leader slots (if not locked and meeting is upcoming)
- Can claim/unclaim open food slots (if not locked and meeting is upcoming)
- Cannot access other groups' data

---

## Supabase Migration (optional)

The app ships with **SQLite** and works fully without Supabase. If you want to run on Supabase Postgres:

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and note your:
- Project URL (`SUPABASE_URL`)
- Anon key (`SUPABASE_ANON_KEY`)
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`)
- Database password

### 2. Run migrations

Open the Supabase SQL Editor and run the files in order:

```sql
-- Run file contents from:
-- supabase/migrations/001_initial.sql  (tables, indexes, types)
-- supabase/migrations/002_rls.sql      (Row Level Security policies)
```

Or use the Supabase CLI:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

### 3. Update the app

1. Install the Postgres driver:
   ```bash
   npm install postgres @supabase/supabase-js
   ```

2. Replace `server/storage.ts` to use `postgres` or `@supabase/supabase-js` instead of `better-sqlite3`

3. Update `server/index.ts` to use a `DATABASE_URL` connection string

4. Update `.env` with your Supabase credentials

### Key differences from SQLite build

| | SQLite (current) | Supabase Postgres |
|---|---|---|
| Auth | bcryptjs + express-session | Supabase Auth (JWT) |
| Storage | `better-sqlite3` | `postgres` driver or Supabase JS client |
| RLS | N/A (app-level checks in routes) | Native Postgres RLS (see `002_rls.sql`) |
| Sessions | `memorystore` (in-memory) | Supabase sessions (JWT in client) |
| Hosting | Any Node.js host | Supabase + Vercel/Railway/Fly.io |

---

## Deployment

### Build

```bash
npm run build
```

Output goes to `dist/` — static frontend in `dist/public/`, server bundle in `dist/index.cjs`.

### Run production server

```bash
NODE_ENV=production SESSION_SECRET=<your-secret> node dist/index.cjs
```

### Recommended hosting options

| Platform | Notes |
|---|---|
| **Railway** | One-click Node.js deploy, persistent disk for SQLite |
| **Render** | Free tier available, set env vars in dashboard |
| **Fly.io** | Good for persistent SQLite with mounted volumes |
| **VPS / DigitalOcean** | Run with `pm2` for process management |

### SQLite persistence note

SQLite stores data in a single file. On platforms with ephemeral filesystems (e.g., Heroku), the database resets on each deploy. Use a platform with persistent disk volumes or migrate to Supabase Postgres.

### Session store note

The current session store is in-memory (`memorystore`). Sessions are lost on server restart. For production with multiple instances or restarts, replace with a persistent store:

```bash
npm install connect-pg-simple  # PostgreSQL session store
# or
npm install connect-redis       # Redis session store
```
