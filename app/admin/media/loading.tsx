export default function AdminMediaLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="h-7 w-24 animate-pulse rounded bg-neutral-200" />
        <div className="h-9 w-32 animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="mb-4 flex gap-2">
        <div className="h-8 w-20 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-8 w-20 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-8 w-20 animate-pulse rounded-md bg-neutral-200" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-white">
            <div className="aspect-square rounded-t-lg bg-neutral-200" />
            <div className="space-y-1.5 p-3">
              <div className="h-3 w-full rounded bg-neutral-200" />
              <div className="h-3 w-2/3 rounded bg-neutral-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
