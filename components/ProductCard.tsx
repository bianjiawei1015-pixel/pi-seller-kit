import Link from "next/link";
import type { Product } from "@/lib/types";
import { PiAmount } from "./PiAmount";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/product/${product.id}`}
      className="group flex items-center gap-3 rounded-card bg-surface p-3 shadow-card ring-1 ring-hairline/60 transition active:scale-[0.99]"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-pi-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={product.productName}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold tracking-tight">
          {product.productName}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">
          {product.description}
        </p>
      </div>
      <PiAmount amount={product.pricePi} size="sm" />
    </Link>
  );
}
