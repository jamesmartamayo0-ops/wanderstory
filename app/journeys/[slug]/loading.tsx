export default function JourneyDetailLoading() {
  return (
    <div className="animate-pulse">
      <div className="aspect-video w-full bg-neutral-200" />
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-12">
        <div className="h-8 w-64 rounded bg-neutral-200" />
        <div className="h-4 w-48 rounded bg-neutral-200" />
        <div className="h-4 w-full rounded bg-neutral-200" />
        <div className="h-4 w-5/6 rounded bg-neutral-200" />
        <div className="h-4 w-3/4 rounded bg-neutral-200" />
        <div className="pt-8 space-y-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-5 w-40 rounded bg-neutral-200" />
              <div className="h-4 w-full rounded bg-neutral-200" />
              <div className="h-4 w-4/5 rounded bg-neutral-200" />
              <div className="h-4 w-3/5 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
