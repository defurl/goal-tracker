# Be Better Everyday

A personal-growth PWA whose interface is a dark, quiet 3D room. Each feature is
a physical object on a desk: you click the phone to import an article, the rose
monitor shows today's two-minute challenge and brightens the room when you
complete it, and a bonsai grows a leaf for each habit you keep.

Its premise is that people save far more self-improvement content than they ever
act on. So the product converts saved articles into micro-actions, and the room
becomes the record of having done them.

> *"The same 3 a.m. desk — but every object on it is evidence that you acted on
> something you saved."*

**Status:** Phase 1 done on both tracks — the lit, furnished room, and the data
foundation (auth, schema, RLS) behind it. Features arrive in Phases 2–3. See
`PROGRESS.md` for where things stand.

---

## Repository layout

| path | what it holds |
|---|---|
| `CLAUDE.md` | instructions for AI agents working in this repo — start here |
| `spec/` | the functional contract: features, data model, AI agents, build plan |
| `design-system/` | the visual contract: the 3D room, extracted from a shipped portfolio project |

Read `spec/README.md` for the reading order across both folders.

---

## The four features

**Action Launcher & Daily Challenge** — paste a URL, an AI agent extracts one
concrete action you can do in under two minutes. One is surfaced each day.

**Glow-up Habit Tracker** — habits tagged as things you are building or things
you are quitting. Completions grow the bonsai and light a cell on the wall.

**Smart Journal** — mood, tags, and an opt-in AI reflection. Entry text is never
stored; only the summary survives.

**Goal Dashboard** — goals broken into milestones on a timeline.

---

## Two things worth knowing about the design

**Nothing punishes the user.** No negative points, no streak-shaming, no wilting
plant — and no confetti either. A missed day gets one signal: nothing grows.

**Journal entries are not retained.** After the AI reflection runs, the original
text is gone. The database has no column capable of holding it. You get the mood,
the tags and the insight; you do not get to re-read what you wrote. That is a
deliberate trade and the onboarding says so.

---

## Stack

Next.js 14 (App Router) · React Three Fiber · Supabase (Postgres + Auth + RLS) ·
OpenAI `gpt-4o-mini` · CSS Modules · Vercel

Notably **not** used, and for documented reasons — see `spec/01-decisions.md`:
Tailwind, shadcn/ui, Inter, and any light mode.

---

## Running it

### Prerequisites

- **Node 24** (`.nvmrc`) and **pnpm 11** — `corepack enable` picks up the
  version `package.json` pins.
- **Docker Desktop**, only for the local database (tests, schema work).

```bash
pnpm install
```

### Environment

Copy `.env.example` to `.env.local` (or `.env` — both are gitignored) and fill in
the anon key from the Supabase dashboard → **API Keys**. The service-role key is
not needed yet; never prefix it with `NEXT_PUBLIC_`.

Without a key the app still runs: you get the default room, and sign-in says it
is not configured.

### The app

```bash
pnpm dev                    # http://localhost:3000 — the room
```

| route | what |
|---|---|
| `/` | the room. Signed out, the default room; signed in, your own |
| `/text` | the same product without WebGL — the mobile and offline path |
| `/login`, `/signup` | email + password, and Google once it is set up (below) |

`pnpm dev` is for working. **Screenshots and the lighting test must come from a
production build** — the dev build trips the adaptive-FPS guard and turns bloom
off:

```bash
pnpm build && pnpm start    # then, in another terminal:
pnpm capture:states         # writes captures/local/
pnpm lighting:test
```

Stop the dev server before `pnpm build`: they share `.next/`.

### The local database

Tests never touch the hosted project — they create and delete users, and refuse
any non-local URL.

```bash
pnpm exec supabase start    # Docker must be running; applies supabase/migrations/
pnpm test:db                # the cross-user isolation gate + function tests
pnpm exec supabase db reset # re-apply every migration from scratch
pnpm db:types               # regenerate lib/supabase/database.types.ts — commit it
pnpm exec supabase stop
```

To run the app against the local database instead of the hosted one, put the
`API_URL` and `ANON_KEY` from `pnpm exec supabase status` into `.env.local` as
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`; it overrides `.env`.
Local sign-up needs no email confirmation.

### Checks — what CI runs

```bash
pnpm lint && pnpm lint:colors && pnpm typecheck && pnpm build && pnpm bundle:check
```

### The hosted project

Migrations reach the hosted database only when you push them — the Supabase
GitHub integration's auto-deploy is off.

```bash
pnpm exec supabase login                                     # once; opens the browser
pnpm exec supabase link --project-ref nosifadaldhgjeyzhpao   # asks for the DB password
pnpm exec supabase db push                                   # applies what is new
```

Then in the dashboard → **Authentication → URL Configuration**: set **Site URL**
to where the app lives, and add `<that URL>/auth/callback` (and
`http://localhost:3000/auth/callback`) to **Redirect URLs**. Email confirmation
and Google both land there.

### Google sign-in (optional)

1. **Google Cloud Console → APIs & Services → OAuth consent screen:** External,
   app name, support email.
2. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized JavaScript origins: `http://localhost:3000` and your production URL
   - Authorized redirect URI: `https://nosifadaldhgjeyzhpao.supabase.co/auth/v1/callback`
     — Supabase's callback, not the app's
3. **Supabase dashboard → Authentication → Sign In / Providers → Google:** enable,
   paste the client ID and secret.
4. Make sure the redirect URLs from the section above are set.

Locally Google is off (`supabase/config.toml`); email sign-in covers local work.

## License

[MIT](LICENSE) — code and documentation alike, including `design-system/`.

The room's geometry, lighting rig, palette and interaction grammar are
documented here in full and are reusable under the same terms. If you build
something from them, an attribution link is welcome but not required.
