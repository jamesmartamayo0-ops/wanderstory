export default function AdminDashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-white p-4">
            <div className="h-3 w-20 rounded bg-neutral-200" />
            <div className="mt-2 h-7 w-12 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <div className="h-5 w-40 rounded bg-neutral-200" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-5 w-full rounded bg-neutral-200" />
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="h-5 w-28 rounded bg-neutral-200" />
          <div className="mt-4 h-4 w-36 rounded bg-neutral-200" />
        </div>
      </div>
      <div className="rounded-lg border bg-white p-4">
        <div className="h-5 w-36 rounded bg-neutral-200" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-neutral-200" />
          ))}
        </div>
      </div>
    </div>
  );
}
