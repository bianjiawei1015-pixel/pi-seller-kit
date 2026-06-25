"use client";

import { useRouter } from "next/navigation";

export function PageHeader({
  title,
  back = false,
  right,
}: {
  title: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 bg-canvas/85 backdrop-blur-md pt-safe">
      <div className="flex h-12 items-center gap-2 px-4">
        {back ? (
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-ink active:bg-hairline"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <div className="h-9 w-1" />
        )}
        <h1 className="flex-1 truncate text-[17px] font-semibold tracking-tight">
          {title}
        </h1>
        {right}
      </div>
      <div className="h-px w-full bg-hairline" />
    </header>
  );
}
