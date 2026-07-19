export default function JourneysLoading() {
  return (
    <div className="bg-[var(--color-surface-alt)] px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center sm:mb-16">
          <div className="mx-auto h-4 w-32 animate-pulse rounded bg-neutral-200" />
          <div className="mx-auto mt-3 h-8 w-64 animate-pulse rounded bg-neutral-200" />
          <div className="mx-auto mt-3 h-4 w-80 animate-pulse rounded bg-neutral-200" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg bg-white">
              <div className="aspect-[4/3] rounded-t-lg bg-neutral-200" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 rounded bg-neutral-200" />
                <div className="h-3 w-1/2 rounded bg-neutral-200" />
                <div className="h-3 w-1/3 rounded bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
