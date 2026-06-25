# Pi Seller Kit

**Create and sell with Pi in minutes.**

A lightweight, mobile-first seller tool for the Pi Network ecosystem. Sellers
create a product page, share the link, and buyers pay with Pi from the Pi
Browser. Orders are recorded in a simple back-office list.

This is an **MVP**: it runs entirely on the front end with **mock data in
`localStorage`** and a **mock Pi payment flow**. It is structured so you can drop
in the real Pi SDK and Supabase later without touching the UI.

---

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** for the mobile UI (iPhone-first, safe-area aware)
- **localStorage** for persistence (survives refresh)
- A single **Pi SDK abstraction** in `lib/pi.ts` (mock today, real later)

---

## Run it locally

You need **Node.js 18.18+** (Node 20+ recommended).

```bash
# 1. install dependencies
npm install

# 2. start the dev server
npm run dev

# 3. open the app
#    http://localhost:3000
```

For the most accurate phone preview, open Chrome DevTools → device toolbar and
pick **iPhone 14/15**, or open `http://<your-LAN-ip>:3000` on your phone.

Other scripts:

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```

---

## Pages & flow

| Route             | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `/`               | App name, tagline, **Create Product** / **View Orders**, list  |
| `/create`         | Product form → generates a product detail link                 |
| `/product/[id]`   | Product detail → **Pay with Pi**                               |
| `/checkout/[id]`  | Order summary → **Mock Pay with Pi** (runs the mock flow)      |
| `/success`        | Payment confirmation + order number → **Back to Home**         |
| `/orders`         | Order list: id, product, amount, buyer, status, date           |

**Buyer flow:** product → checkout → (login → create payment → complete) →
success → order appears in `/orders`.

Two sample products are seeded on first run so the app isn't empty. Clear them
by running `localStorage.clear()` in the browser console.

---

## Project structure

```
app/
  layout.tsx            # root layout, viewport, AppShell, (Pi SDK <Script> hook)
  globals.css           # tokens + iPhone safe-area utilities
  page.tsx              # home
  create/page.tsx       # create product form
  product/[id]/page.tsx # product detail
  checkout/[id]/page.tsx# mock payment flow
  success/page.tsx      # confirmation
  orders/page.tsx       # orders list
components/
  AppShell, PageHeader, Button, Field,
  PiAmount, ProductCard, OrderCard, EmptyState
lib/
  pi.ts                 # ⭐ Pi SDK layer (mock now, swap later)
  storage.ts            # ⭐ localStorage data layer (swap for Supabase later)
  types.ts              # Product / Order types
  id.ts                 # id + formatting helpers
  seed.ts               # first-run sample products
```

The two `⭐` files are the only ones you replace to go from MVP to production.

---

## Next step 1 — connect the real Pi SDK

Everything lives in **`lib/pi.ts`**. To go live:

1. **Load the SDK.** In `app/layout.tsx`, add inside the component:
   ```tsx
   import Script from "next/script";
   // ...
   <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="beforeInteractive" />
   ```
2. **Flip the switch.** In `lib/pi.ts`, set `MOCK_MODE = false`.
3. **Fill in the real calls.** Each function has a `// REAL:` block showing the
   exact `window.Pi.*` call to uncomment:
   - `initPiSDK` → `Pi.init({ version: "2.0", sandbox: true })`
   - `loginWithPi` → `Pi.authenticate(["username", "payments"], …)`
   - `createPiPayment` → `Pi.createPayment({ amount, memo, metadata }, callbacks)`
   - `completePiPayment` / `cancelPiPayment` / `errorPiPayment` → wired to the
     SDK callbacks.
4. **Add the two server endpoints Pi requires** (Pi completes payments
   server-side with your app's API key):
   - `POST /api/pi/approve`  → calls Pi Platform `/payments/{id}/approve`
   - `POST /api/pi/complete` → calls Pi Platform `/payments/{id}/complete`
   Keep your Pi API key in a server-only env var (`PI_API_KEY`), never in the
   client.
5. Test inside the **Pi Browser / sandbox**. `window.Pi` only exists there.

Because every page already calls `loginWithPi` / `createPiPayment` /
`completePiPayment` from this one module, **no page code changes** are needed.

## Next step 2 — connect Supabase

Replace the body of each function in **`lib/storage.ts`** with Supabase queries
(`products` and `orders` tables that mirror `lib/types.ts`). The function
signatures stay the same, so pages don't change. Suggested tables:

- `products(id, product_name, price_pi, description, image_url, seller_contact, delivery_note, created_at)`
- `orders(order_id, product_id, product_name, amount_pi, buyer_username, status, payment_id, created_at)`

---

## Security & scope (by design)

- ❌ Never asks for a seed phrase, mnemonic, or private key.
- ❌ Never collects or stores private keys / wallet secrets.
- ✅ Login and payment happen **only** through the Pi SDK.
- ✅ Stores only a public username on the order for display.
- ❌ No price predictions, returns/yield promises, gambling, lotteries, or
  fund-pooling.
- Intentionally **not** included: chat, escrow, refunds, or a full marketplace.

This keeps the kit a focused seller tool, not a financial product.
