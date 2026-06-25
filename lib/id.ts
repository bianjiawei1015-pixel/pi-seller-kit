// Tiny helpers shared across the app.

// Short, URL-friendly id (e.g. "k3f9q2a1"). Good enough for an MVP that stores
// data in localStorage. Not for cryptographic use.
export function shortId(length = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  // crypto.getRandomValues is available in browsers; fall back to Math.random.
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) out += alphabet[values[i] % alphabet.length];
  } else {
    for (let i = 0; i < length; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return out;
}

// Order ids get a readable prefix so they're easy to recognise in a list.
export function newOrderId(): string {
  return `PSK-${shortId(6).toUpperCase()}`;
}

// Format a Pi amount consistently. Pi commonly shows up to a few decimals;
// we trim trailing zeros but keep it tidy.
export function formatPi(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  const rounded = Math.round(amount * 1e7) / 1e7; // avoid float noise
  return rounded.toString();
}

// Human-friendly timestamp for lists.
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
