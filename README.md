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

**Status:** Phases 1 and 2 done on both tracks. The room is lit and furnished;
behind it are auth, the schema and RLS, the two AI agents, and `/text` — every
feature, usable without WebGL and offline. The room's own mechanics arrive in
Phase 3. See `PROGRESS.md` for where things stand.

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
Google Gemini `gemini-2.5-flash-lite` · CSS Modules · Vercel

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

Copy `.env.example` to `.env.local` (or `.env` — both are gitignored) and fill in:

| variable | from | without it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → **API Keys** | the default room only; sign-in says it is not configured |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, the secret key | the agents cannot rate-limit, so they never call the model — every import and reflection gets a curated fallback |
| `GEMINI_API_KEY` | Google AI Studio — free tier (below) | every import gets a curated fallback action instead |
| `CRON_SECRET` | any long random string | `/api/cron/seed-challenges` refuses every call (the hourly sweep runs in the database regardless) |
| `NEXT_PUBLIC_AI_REFLECT` | `on`, or leave empty | **leave it empty on a free key** — the journal then saves mood and tags and never sends an entry to the AI |

`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` and `CRON_SECRET` are server-only:
never prefix them with `NEXT_PUBLIC_`, and they are read only under `app/api/`.

### Getting the keys

**What is required, and what is not.** Only the anon key is needed to use the
product. With it alone you can sign up, and use habits, the journal (without AI
Reflect), goals and the Daily Challenge in full. The other three switch on
extras:

| you have | what works |
|---|---|
| nothing | the default room and `/text`, signed out |
| anon key | everything except the AI: imports become curated two-minute actions |
| + service-role key + Gemini key | the import agent: a real action drawn from each article |
| + `CRON_SECRET` | the manual seeder route — optional; the hourly sweep already runs in the database |
| + `NEXT_PUBLIC_AI_REFLECT=on` | journal reflections — **only with a paid key**, see below |

Without an AI key the app never shows an error — every AI path ends in a curated
fallback by design (FALLBACK-1). You can run on that indefinitely and add the
key later; nothing needs changing but the env file.

**1 · Supabase — anon and service-role keys (free).** The project already exists.

1. Open the project in the [Supabase dashboard](https://supabase.com/dashboard)
   → **Project Settings** → **API Keys**.
2. **Anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`. On the newer key screen this
   is the *publishable* key (`sb_publishable_…`); on the **Legacy API keys** tab
   it is `anon`. Either works. Safe in the browser: RLS limits it to the
   signed-in user's own rows.
3. **Service-role key** → `SUPABASE_SERVICE_ROLE_KEY`. The *secret* key
   (`sb_secret_…`), or `service_role` on the legacy tab. **This one bypasses
   every RLS policy.** Never commit it, never paste it into chat or a ticket,
   never give it a `NEXT_PUBLIC_` prefix. If it leaks, rotate it on the same
   page.

**2 · Gemini — the AI key (free tier).** The provider is Google's Gemini
(owner decision 2026-09-25, amending D-19), model `gemini-2.5-flash-lite`.

1. Go to [Google AI Studio](https://aistudio.google.com) and sign in with a
   Google account. No Google Cloud billing is needed for the free tier.
2. **Get API key → Create API key.** Copy it into `GEMINI_API_KEY`.
3. Same rules as the service-role key: server-only, never committed, never
   pasted anywhere else. If it leaks, delete it in AI Studio and make another.

What the free tier means for this app — read Google's current Gemini API terms
yourself, because these are the parts that matter:

- **It costs nothing, and it cannot run up a bill.** COST-1's spend cap is met
  by construction while no billing is attached.
- **It is rate-limited** (requests per minute and per day). Past the limit
  Google answers 429 and the user simply gets a curated fallback action.
- **Google may use what is sent to improve its products, and human reviewers
  may read it.** That is fine for a public article. It is **not** fine for a
  journal entry, which is why AI Reflect is off: with `NEXT_PUBLIC_AI_REFLECT`
  empty, the journal saves mood and tags, never sends the text anywhere, and
  says so on the form.

**Turning AI Reflect on later.** Only with a key whose terms do not use inputs
for training or review — on Gemini, that means enabling billing on the key's
Google Cloud project (the paid tier). Then set `NEXT_PUBLIC_AI_REFLECT=on`,
rebuild, and put a hard budget on that project first (COST-1). Nothing else
changes. Before it goes to real users, the Privacy Policy (Phase 4) has to say
plainly where entries go.

**3 · `CRON_SECRET` (free, optional).** Any long random string. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Call the route with it as `Authorization: Bearer <secret>` to run the Daily
Challenge sweep by hand.

**Where the keys go.** Locally, in `.env.local` (or `.env`), then restart
`pnpm dev` (a `NEXT_PUBLIC_` value is baked in at build time, so also rebuild
before `pnpm start`). When the app is deployed, the same names go in the host's
environment variables (on Vercel: **Project → Settings → Environment
Variables**). They are never committed: both env files are gitignored.

### The app

```bash
pnpm dev                    # http://localhost:3000 — the room
```

| route | what |
|---|---|
| `/` | the room. Signed out, the default room; signed in, your own |
| `/text` | the same product without WebGL — the mobile and offline path. Phones visiting `/` land here; its "enter the room" link opts that browser out |
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
pnpm test:db                # isolation gate, functions, both agents, the AC-3.2 dump gate
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
pnpm lint && pnpm lint:colors && pnpm typecheck && pnpm test && pnpm build && pnpm bundle:check
```

`pnpm test` needs no database and no network: the agents' guards, error mapping
and fallbacks, with everything external injected.

The service worker registers in production builds only, so check offline
behaviour against `pnpm build && pnpm start`, not `pnpm dev`.

### The hosted project

Migrations reach the hosted database only when you push them — the Supabase
GitHub integration's auto-deploy is off.

```bash
pnpm exec supabase login                                     # once; opens the browser
pnpm exec supabase link --project-ref nosifadaldhgjeyzhpao   # asks for the DB password
pnpm exec supabase db push                                   # applies what is new
```

Migration 018 enables `pg_cron` and schedules the hourly Daily Challenge sweep
inside the database — no Vercel cron, so any hosting plan works.

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
5. Set `NEXT_PUBLIC_AUTH_GOOGLE=on` in your env file and restart. Until then the
   "continue with google" button is hidden.

An OAuth client itself needs no billing account. If the Cloud console insists
on a trial or "express mode" upgrade first, email sign-in covers everything in
the meantime; Google can be added later without code changes.

Locally Google is off (`supabase/config.toml`); email sign-in covers local work.

## License

[MIT](LICENSE) — code and documentation alike, including `design-system/`.

The room's geometry, lighting rig, palette and interaction grammar are
documented here in full and are reusable under the same terms. If you build
something from them, an attribution link is welcome but not required.
