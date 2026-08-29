import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] px-6">
      <div className="max-w-md text-center">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-semibold text-[var(--color-text-primary)]">
          Page Not Found
        </h1>
        <p className="mt-3 font-[family-name:var(--font-body)] text-[var(--color-text-muted)]">
          The page you&apos;re looking for doesn&apos;t exist or has been
          moved.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="rounded-[var(--radius-pill)] bg-[var(--color-interactive)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-on-media)] transition-colors hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
