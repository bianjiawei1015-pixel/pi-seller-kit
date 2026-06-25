// Centers the app in a phone-width column and gives larger screens a calm
// backdrop so the product always reads as a mobile app — iPhone first.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-canvas">
      <div className="mx-auto flex min-h-dvh w-full max-w-app flex-col bg-canvas shadow-[0_0_60px_rgba(25,19,49,0.06)]">
        {children}
      </div>
    </div>
  );
}
