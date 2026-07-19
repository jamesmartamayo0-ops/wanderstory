import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="py-16 text-center">
      <h2 className="text-xl font-semibold text-neutral-900">Not Found</h2>
      <p className="mt-2 text-sm text-neutral-500">
        This admin page doesn&apos;t exist.
      </p>
      <div className="mt-6">
        <Link
          href="/admin"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
