"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  console.error(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="max-w-md text-center">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-semibold text-neutral-900">
          Something went wrong
        </h1>
        <p className="mt-3 font-[family-name:var(--font-body)] text-neutral-500">
          An unexpected error occurred. Please try again.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Try again
          </button>
          <Link
            href="/"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
