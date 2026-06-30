-- Pi Seller Kit — initial schema
-- Run this in the Supabase SQL editor (or via the Supabase CLI) once per project.
-- Safe to re-run: it uses IF NOT EXISTS / idempotent guards.

-- gen_random_uuid() lives in pgcrypto. It is preinstalled on Supabase, but
-- enabling it explicitly keeps this migration self-contained.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- users: one row per Pi account that has logged in.
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  pi_uid      text unique not null,
  pi_username text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- products: items a seller offers. id is a short text id used in shareable URLs.
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id             text primary key,
  seller_uid     text not null,
  product_name   text not null,
  price_pi       numeric not null,
  description    text,
  image_url      text,
  seller_contact text,
  delivery_note  text,
  status         text default 'active',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists products_seller_uid_idx on public.products (seller_uid);
create index if not exists products_status_idx on public.products (status);

-- ----------------------------------------------------------------------------
-- orders: one row per purchase attempt. amount_pi is copied from the product
-- at creation time by the server (never trusted from the client).
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  order_id       text primary key,
  product_id     text not null references public.products (id),
  seller_uid     text not null,
  buyer_uid      text not null,
  buyer_username text not null,
  amount_pi      numeric not null,
  payment_id     text,
  txid           text,
  status         text not null default 'pending',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists orders_product_id_idx on public.orders (product_id);
create index if not exists orders_seller_uid_idx on public.orders (seller_uid);
create index if not exists orders_buyer_uid_idx on public.orders (buyer_uid);

-- ----------------------------------------------------------------------------
-- Row Level Security
--
-- The app reads and writes through Next.js API routes using the SERVICE ROLE
-- key, which bypasses RLS. Enabling RLS therefore locks the tables down for the
-- public anon key while leaving the app fully functional.
--
-- The only public grant is read access to active products, so a catalogue can
-- safely be queried with the anon key if you ever wire up the browser client.
-- Orders and users stay server-only.
-- ----------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products
  for select
  using (status = 'active');
