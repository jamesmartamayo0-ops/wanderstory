export default function AdminJourneyEditLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-4 w-40 rounded bg-neutral-200" />
        <div className="mt-2 h-7 w-48 rounded bg-neutral-200" />
      </div>
      <div className="max-w-lg space-y-4 rounded-lg border p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 w-24 rounded bg-neutral-200" />
            <div className="h-10 w-full rounded-md bg-neutral-200" />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <div className="h-10 w-20 rounded-md bg-neutral-200" />
          <div className="h-10 w-20 rounded-md bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}
