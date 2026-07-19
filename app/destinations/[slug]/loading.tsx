export default function DestinationDetailLoading() {
  return (
    <div className="animate-pulse">
      <div className="aspect-video w-full bg-neutral-200" />
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-12">
        <div className="h-8 w-64 rounded bg-neutral-200" />
        <div className="h-4 w-32 rounded bg-neutral-200" />
        <div className="h-4 w-full rounded bg-neutral-200" />
        <div className="h-4 w-3/4 rounded bg-neutral-200" />
        <div className="pt-8">
          <div className="mb-4 h-6 w-48 rounded bg-neutral-200" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-white">
                <div className="aspect-[4/3] rounded-t-lg bg-neutral-200" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 rounded bg-neutral-200" />
                  <div className="h-3 w-1/2 rounded bg-neutral-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
