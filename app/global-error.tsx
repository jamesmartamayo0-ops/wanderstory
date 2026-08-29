"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  console.error(error);

  return (
    <html lang="en">
      <body className="m-0 bg-white text-[#171717] antialiased [color-scheme:light] [font-family:Arial,sans-serif]">
        <div className="flex min-h-screen items-center justify-center bg-white px-6">
          <div className="max-w-md text-center">
            <h1 className="text-3xl font-semibold text-[#171717]">
              Something went wrong
            </h1>
            <p className="mt-3 text-[#525252]">
              A critical error occurred. Please try again.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={reset}
                className="rounded-md bg-[#171717] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
              >
                Try again
              </button>
              <Link
                href="/"
                className="text-sm font-medium text-[#1d4ed8] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
              >
                Go home
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
