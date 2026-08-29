export default function DestinationsLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-surface-alt)] px-6 pt-32 pb-20 sm:pb-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center sm:mb-16">
          <div className="mx-auto h-4 w-32 animate-pulse rounded bg-[var(--color-border-strong)]" />
          <div className="mx-auto mt-3 h-8 w-64 animate-pulse rounded bg-[var(--color-border-strong)]" />
          <div className="mx-auto mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-[var(--color-border-strong)]" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
              <div className="aspect-[4/3] rounded-t-lg bg-[var(--color-border-strong)]" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 rounded bg-[var(--color-border-strong)]" />
                <div className="h-3 w-1/2 rounded bg-[var(--color-border-strong)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
