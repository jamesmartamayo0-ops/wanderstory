export default function AdminClientsLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="h-7 w-28 animate-pulse rounded bg-neutral-200" />
        <div className="h-9 w-28 animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-neutral-200" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="hover:bg-neutral-50">
                {Array.from({ length: 5 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div
                      className={`h-4 animate-pulse rounded bg-neutral-200 ${
                        j === 0 ? "w-28" : j === 4 ? "w-20 ml-auto" : "w-20"
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
