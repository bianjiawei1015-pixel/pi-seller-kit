# Pi Seller Kit

**Create and sell with Pi in minutes.**

A lightweight, mobile-first seller tool for the Pi Network ecosystem. Sellers
create a product page, share the link, and buyers pay with Pi from the Pi
Browser. Products, orders, and users are persisted in **Supabase**; login and
payment go through the **real Pi SDK** and the Pi Platform API.

---

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** for the mobile UI (iPhone-first, safe-area aware)
- **Supabase** (PostgreSQL) for persistence — `products`, `orders`, `users`
- **Pi SDK** for login + payments, with server-side verify/approve/complete
  routes that use server-only secrets

`localStorage` is **not** a data store. Products and orders live in Supabase and
are reached only through the API routes. The browser keeps only the logged-in
Pi user's **public** `uid` + `username` (so the name survives a refresh). The Pi
`accessToken` is **never** stored — it is sent once to the server for
verification and then discarded.

---

## 1. Configure Supabase

1. Create a project at <https://supabase.com> (free tier is fine).
2. Open **Project Settings → API** and copy three values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only secret)

The app talks to the database through Next.js API routes using the
**service-role** client (which bypasses Row Level Security). RLS is still enabled
on every table as defence-in-depth; the only public (anon) grant is read access
to `active` products.

## 2. Run the database migration

The schema lives in `supabase/migrations/0001_init.sql`. It creates three tables
(`users`, `products`, `orders`) with RLS enabled. It is idempotent (uses
`create table if not exists`), so it is safe to re-run.

**Option A — Supabase SQL editor (quickest):**
Dashboard → **SQL Editor** → **New query** → paste the contents of
`supabase/migrations/0001_init.sql` → **Run**.

**Option B — Supabase CLI:**

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push          # applies supabase/migrations/*
# or, to run the single file directly:
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
```

## 3. Configure `.env.local`

Copy the example and fill in real values, then restart the dev server:

```bash
cp .env.local.example .env.local
```

| Variable                        | Exposed to browser? | Purpose                                          |
| ------------------------------- | ------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes                 | Supabase project URL                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes                 | Supabase anon key (RLS-protected reads)          |
| `SUPABASE_SERVICE_ROLE_KEY`     | **NO — secret**     | Service-role key; bypasses RLS (server only)     |
| `PI_API_KEY`                    | **NO — secret**     | Pi Platform API key; used only in `/api/pi/*`    |
| `NEXT_PUBLIC_PI_SANDBOX`        | yes                 | `true` for Pi Sandbox builds, `false` for prod   |

`PI_API_KEY` comes from the **Pi Developer Portal**. `NEXT_PUBLIC_*` values are
inlined into the client bundle by Next.js — never put a secret behind that
prefix (see "Secrets that must never reach the frontend" below).

## 4. Run locally

You need **Node.js 18.18+** (Node 20+ recommended).

```bash
npm install        # installs deps and keeps package-lock.json in sync
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # run the production build
npm run lint       # eslint
npm ci             # clean, lockfile-exact install (used in CI)
```

The Pi SDK (`window.Pi`) only exists inside the **Pi Browser / sandbox**, so
login and payments must be tested there. The database starts **empty** — there
is no seed data; products appear after a logged-in seller creates them.

## 5. Check the database health endpoint

`GET /api/db/health` reports real connectivity:

```bash
curl -s http://localhost:3000/api/db/health
```

- `{ "ok": true, "database": "connected" }` — env vars set and a query to
  `products` succeeded.
- HTTP `503 { "ok": false, "database": "not_configured" }` — Supabase env vars
  are missing.
- HTTP `500 { "ok": false, "database": "error", "message": ... }` — configured,
  but the query failed (wrong keys, migration not run, network).

## 6. Deploy to Vercel

1. Push the repo to GitHub/GitLab and **Import Project** in Vercel.
2. Framework preset auto-detects **Next.js**; no build settings needed
   (`next build`).
3. In **Project → Settings → Environment Variables**, add all five variables
   from the table above for the **Production** (and Preview) environments. Use
   `NEXT_PUBLIC_PI_SANDBOX=false` for production.
4. Deploy. After it builds, hit `https://YOUR-APP.vercel.app/api/db/health` to
   confirm the database connection.
5. Register the deployed URL in the **Pi Developer Portal** (app URL + the
   `public/validation-key.txt` is served at `/validation-key.txt`).

`SUPABASE_SERVICE_ROLE_KEY` and `PI_API_KEY` are read only inside server-side API
routes (Node runtime), so they stay on Vercel's servers and are never sent to
the browser.

---

## Secrets that must never reach the frontend

- `SUPABASE_SERVICE_ROLE_KEY` — full database access; bypasses RLS. Server only.
- `PI_API_KEY` — Pi Platform server key; can approve/complete payments. Server
  only, used exclusively in `/api/pi/approve`, `/api/pi/complete`,
  `/api/pi/payment`.
- The Pi **accessToken** — never written to `localStorage`; sent once to
  `/api/pi/me` (and to privileged write routes) and then discarded.

Anything prefixed `NEXT_PUBLIC_` **is** shipped to the browser, so only
non-sensitive values (the Supabase URL, the anon key, the sandbox flag) use it.

---

## Identity & payment security model

The amount, the seller, and the order state are **never trusted from the
client**:

- **Login — `POST /api/pi/me`.** After `Pi.authenticate`, the client sends the
  access token here once. The server calls the Pi Platform `/me` endpoint
  (Bearer token) to verify the user, upserts the `users` row, and returns only
  the verified `uid` + `username`. The client stores just those; the token is
  never persisted.
- **Create product — `POST /api/products`.** The client sends a **fresh** Pi
  access token (not a uid). The server verifies it and sets `seller_uid` from
  the verified identity, **ignoring any client-supplied uid**.
- **Create order — `POST /api/orders`.** The amount is read from the product row
  in the database, never from the request body.
- **Approve — `POST /api/pi/approve`.** Loads the order, fetches the payment from
  the Pi Platform, verifies `identifier`/`amount`/`metadata.orderId`/
  `metadata.productId`/`user_uid` against the stored order, then approves and
  marks the order `approved` **server-side**.
- **Complete — `POST /api/pi/complete`.** Re-checks the order + `payment_id`,
  completes on the Pi Platform with the on-chain `txid`, and only on success
  marks the order `paid` **server-side**.
- **`PATCH /api/orders/[orderId]`** can only set `cancelled` / `failed`. It can
  never set `approved`/`paid` or write `payment_id`/`txid`, and a `paid` order is
  immutable.
- **`GET /api/orders`** never lists all orders — a `sellerUid` or `buyerUid`
  scope is required.
- **`GET /api/pi/payment`** is a debug-only endpoint and returns `404` when
  `NODE_ENV === "production"`.

### ⚠️ Transitional limitations — must be closed before production

This kit verifies identity per privileged write (re-checking a fresh Pi access
token) instead of maintaining a server session. Two gaps remain and are called
out in code comments:

1. **Order list scope is trust-on-input.** `GET /api/orders?sellerUid=…` (and
   `?buyerUid=…`) currently trusts the uid in the query string — any caller can
   request any uid's orders. Before production this MUST derive the uid from a
   verified session/token (as `/api/pi/me` does) and reject requests for a uid
   the caller has not proven they own.
2. **No shared session.** Product creation re-authenticates to obtain a fresh
   token because there is no signed, httpOnly session cookie yet. The proper fix
   is to mint such a cookie after `/api/pi/me` and have privileged routes read
   the identity from it. Order creation's `buyerUid` is likewise trust-on-input
   until then.

Until those are in place, treat the order list and order/seller binding as
**not hardened for production**.

---

## Project structure

```
app/
  layout.tsx              # root layout, viewport, AppShell, Pi SDK <Script>
  page.tsx                # home (products from /api/products) + Pi login
  create/page.tsx         # create product (re-verifies a fresh Pi token)
  product/[id]/page.tsx   # product detail
  checkout/[id]/page.tsx  # real Pi payment flow
  success/page.tsx        # confirmation
  orders/page.tsx         # seller-scoped orders list (login required)
  api/
    pi/me/                # verify Pi access token, upsert user
    pi/approve|complete/  # server-side payment approve / complete
    pi/payment/           # debug only (404 in production)
    pi/incomplete/        # reports incomplete payments for debugging
    products/             # GET list, POST create (server derives seller_uid)
    orders/               # GET (scoped), POST create; [orderId] GET/PATCH
    db/health/            # Supabase connectivity check
components/               # AppShell, PageHeader, Button, Field, PiLogin, ...
lib/
  supabase.ts             # anon + service-role clients
  db.ts                   # server-side data layer (snake_case <-> camelCase)
  api.ts                  # route helpers (supabaseGuard, jsonError, ...)
  client.ts               # browser fetchers for the API routes
  pi.ts                   # client Pi SDK layer (login, token, payments)
  pi-server.ts            # server-only Pi Platform calls (/me, approve, ...)
  storage.ts              # localStorage: Pi session (uid/username) ONLY
  types.ts                # Product / Order / PiSessionUser types
  id.ts                   # id + formatting helpers
supabase/
  migrations/0001_init.sql
```

---

## Security & scope (by design)

- ❌ Never asks for a seed phrase, mnemonic, or private key.
- ❌ Never collects or stores private keys / wallet secrets, and never stores the
  Pi `accessToken`.
- ✅ Login and payment happen **only** through the Pi SDK, verified server-side.
- ✅ Payment amount, seller identity, and approval/completion are verified and
  recorded **server-side** against the database.
- ✅ `localStorage` holds only the public Pi `uid` / `username` for display.
- ❌ No price predictions, returns/yield promises, gambling, lotteries, or
  fund-pooling.
- Intentionally **not** included: chat, escrow, refunds, or a full marketplace.

Before going live you **must** configure Supabase (URL + anon + service-role
keys, and run the migration), set a real `PI_API_KEY`, and close the two
transitional limitations above.
