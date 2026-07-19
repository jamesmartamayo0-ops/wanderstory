export default function AdminCategoriesLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="h-7 w-36 animate-pulse rounded bg-neutral-200" />
        <div className="h-9 w-32 animate-pulse rounded bg-neutral-200" />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {Array.from({ length: 3 }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-neutral-200" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="hover:bg-neutral-50">
                {Array.from({ length: 3 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div
                      className={`h-4 animate-pulse rounded bg-neutral-200 ${
                        j === 0 ? "w-32" : j === 2 ? "w-20 ml-auto" : "w-24"
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
