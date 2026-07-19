import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="max-w-md text-center">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-semibold text-neutral-900">
          Page Not Found
        </h1>
        <p className="mt-3 font-[family-name:var(--font-body)] text-neutral-500">
          The page you&apos;re looking for doesn&apos;t exist or has been
          moved.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
