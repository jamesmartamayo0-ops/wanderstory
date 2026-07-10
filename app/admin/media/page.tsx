import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import * as mediaService from "@/services/media.service";
import { deleteMedia } from "@/actions/media.actions";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

const typeLabels: Record<string, string> = {
  IMAGE: "Image",
  VIDEO: "Video",
  DOCUMENT: "PDF",
};

const typeColors: Record<string, string> = {
  IMAGE: "text-green-600 bg-green-50",
  VIDEO: "text-blue-600 bg-blue-50",
  DOCUMENT: "text-amber-600 bg-amber-50",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; type?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const filters: Parameters<typeof mediaService.getAllMedia>[0] = {};

  if (params.search) filters.search = params.search;
  if (params.type && ["IMAGE", "VIDEO", "DOCUMENT"].includes(params.type)) {
    filters.type = params.type as "IMAGE" | "VIDEO" | "DOCUMENT";
  }

  const media = await mediaService.getAllMedia(filters);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Media Library</h1>
        <Link href="/admin/media/upload">
          <Button type="button" variant="primary">
            Upload
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <form className="flex gap-2">
          <input
            name="search"
            type="text"
            defaultValue={params.search ?? ""}
            placeholder="Search by filename..."
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <div className="flex gap-1">
          {["IMAGE", "VIDEO", "DOCUMENT"].map((type) => (
            <Link
              key={type}
              href={`/admin/media${params.type === type ? "" : `?type=${type}`}`}
              className={`rounded-md px-3 py-1.5 text-sm ${
                params.type === type
                  ? "bg-blue-100 text-blue-700"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {typeLabels[type]}
            </Link>
          ))}
          {params.type && (
            <Link
              href="/admin/media"
              className="rounded-md px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700"
            >
              Clear
            </Link>
          )}
        </div>
      </div>

      {media.length === 0 ? (
        <EmptyState
          title="No media found"
          description={
            params.search
              ? `No results for "${params.search}".`
              : "Upload your first media asset."
          }
actionLabel="Upload"
          actionHref="/admin/media/upload"
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {media.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-lg border bg-white"
            >
              <div className="aspect-square overflow-hidden bg-neutral-100">
                {item.type === "IMAGE" && item.url ? (
                  <img
                    src={item.thumbnailUrl ?? item.url}
                    alt={item.altText ?? item.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : item.type === "VIDEO" ? (
                  <div className="flex h-full items-center justify-center">
                    <svg
                      className="h-12 w-12 text-neutral-400"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <svg
                      className="h-12 w-12 text-neutral-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              <div className="p-2">
                <p className="truncate text-xs font-medium">
                  {item.fileName}
                </p>
                <div className="mt-1 flex items-center gap-1">
                  <span
                    className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${typeColors[item.type] ?? ""}`}
                  >
                    {typeLabels[item.type] ?? item.type}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {formatSize(item.size)}
                  </span>
                </div>
              </div>

              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <form action={deleteMedia.bind(null, item.id) as unknown as (formData: FormData) => void}>
                  <button
                    type="submit"
                    className="rounded-md bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                    onClick={(e) => {
                      if (!confirm("Delete this media?")) {
                        e.preventDefault();
                      }
                    }}
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}