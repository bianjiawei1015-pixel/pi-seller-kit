import { formatPi } from "@/lib/id";

// The signature element: every Pi price renders as a monospace, balance-style
// chip with the π glyph — so an amount always reads like a wallet number, never
// like plain marketing text.
export function PiAmount({
  amount,
  size = "md",
}: {
  amount: number;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-[13px] px-2 py-0.5 gap-1",
    md: "text-[15px] px-2.5 py-1 gap-1.5",
    lg: "text-[22px] px-3 py-1.5 gap-1.5",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-pill bg-pi-50 font-mono font-semibold text-pi-700 tnum ${sizes[size]}`}
    >
      <span aria-hidden className="opacity-70">
        π
      </span>
      {formatPi(amount)}
    </span>
  );
}
