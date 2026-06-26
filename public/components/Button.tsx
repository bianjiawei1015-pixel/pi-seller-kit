import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex h-14 w-full items-center justify-center gap-2 rounded-pill px-5 text-[16px] font-semibold tracking-tight transition active:scale-[0.985] disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pi-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

const variants: Record<Variant, string> = {
  primary: "bg-pi-600 text-white shadow-cta active:bg-pi-700",
  secondary: "bg-surface text-ink ring-1 ring-hairline active:bg-pi-50",
  ghost: "bg-transparent text-pi-600 active:bg-pi-50",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  href,
  children,
}: {
  variant?: Variant;
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
