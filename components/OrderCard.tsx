import type { Order, OrderStatus } from "@/lib/types";
import { formatDate } from "@/lib/id";
import { PiAmount } from "./PiAmount";

const statusStyles: Record<OrderStatus, string> = {
  paid: "bg-success/10 text-success",
  approved: "bg-pi-50 text-pi-700",
  pending: "bg-pi-50 text-pi-700",
  cancelled: "bg-hairline text-muted",
  failed: "bg-danger/10 text-danger",
  incomplete: "bg-danger/10 text-danger",
};

const statusLabel: Record<OrderStatus, string> = {
  paid: "Paid",
  approved: "Approved",
  pending: "Pending",
  cancelled: "Cancelled",
  failed: "Failed",
  incomplete: "Incomplete",
};

export function OrderCard({ order }: { order: Order }) {
  return (
    <div className="rounded-card bg-surface p-4 shadow-card ring-1 ring-hairline/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight">
            {order.productName}
          </p>
          <p className="mt-0.5 font-mono text-[12px] text-muted tnum">
            {order.orderId}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-pill px-2.5 py-1 text-[12px] font-medium ${statusStyles[order.status]}`}
        >
          {statusLabel[order.status]}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-[13px] text-muted">
          <span className="text-ink">@{order.buyerUsername}</span>
          <span className="mx-1.5 text-hairline">·</span>
          {formatDate(order.createdAt)}
        </div>
        <PiAmount amount={order.amountPi} size="sm" />
      </div>

      {/* Pi payment references (shown once they exist). */}
      {order.paymentId || order.txid ? (
        <div className="mt-3 space-y-1 border-t border-hairline pt-3 font-mono text-[11px] text-muted tnum">
          {order.paymentId ? (
            <p className="truncate">paymentId: {order.paymentId}</p>
          ) : null}
          {order.txid ? <p className="truncate">txid: {order.txid}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
