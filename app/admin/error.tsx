"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  console.error(error);

  return (
    <div className="py-16 text-center">
      <h2 className="text-xl font-semibold text-neutral-900">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-neutral-500">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Try again
      </button>
    </div>
  );
}
