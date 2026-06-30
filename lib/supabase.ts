// Supabase clients for Pi Seller Kit.
//
// Two clients are exported:
//   - `supabase`      : uses the public anon key. Safe for the browser and for
//                       ordinary (RLS-protected) reads.
//   - `supabaseAdmin` : uses the service role key. Server-only. It bypasses RLS
//                       and must ONLY be imported from API routes.
//
// SECURITY:
//   SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so Next.js never
//   inlines it into the client bundle. In any browser bundle that happens to
//   import this file, `process.env.SUPABASE_SERVICE_ROLE_KEY` is `undefined`,
//   which makes `supabaseAdmin` resolve to `null` there — the secret string is
//   never shipped to the client.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// True only when every value required for full server-side persistence exists.
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && serviceRoleKey);
}

// Anon client. Available whenever the public URL + anon key are set.
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: false },
      })
    : null;

// Service-role client. Server-only; `null` on the client (see SECURITY note).
export const supabaseAdmin: SupabaseClient | null =
  url && serviceRoleKey
    ? createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
