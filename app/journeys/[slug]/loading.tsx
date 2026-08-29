export default function JourneyDetailLoading() {
  return (
    <div className="min-h-screen animate-pulse bg-[var(--color-surface)]">
      <div className="aspect-video w-full bg-[var(--color-border-strong)]" />
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-12">
        <div className="h-8 w-64 rounded bg-[var(--color-border-strong)]" />
        <div className="h-4 w-48 rounded bg-[var(--color-border-strong)]" />
        <div className="h-4 w-full rounded bg-[var(--color-border-strong)]" />
        <div className="h-4 w-5/6 rounded bg-[var(--color-border-strong)]" />
        <div className="h-4 w-3/4 rounded bg-[var(--color-border-strong)]" />
        <div className="pt-8 space-y-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-5 w-40 rounded bg-[var(--color-border-strong)]" />
              <div className="h-4 w-full rounded bg-[var(--color-border-strong)]" />
              <div className="h-4 w-4/5 rounded bg-[var(--color-border-strong)]" />
              <div className="h-4 w-3/5 rounded bg-[var(--color-border-strong)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
