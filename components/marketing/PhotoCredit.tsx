import type { DestinationCredit } from "@/lib/adapters/destination.adapter";
import { formatPhotoCredit } from "@/lib/attribution";

interface PhotoCreditProps {
  credit: DestinationCredit;
  variant?: "overlay" | "default";
  className?: string;
}

export default function PhotoCredit({
  credit,
  variant = "default",
  className = "",
}: PhotoCreditProps) {
  const overlay = variant === "overlay";
  const textClass = overlay
    ? "text-xs text-[var(--color-media-caption)] [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]"
    : "text-xs text-[var(--color-text-muted)]";
  const linkClass = overlay
    ? "rounded-sm underline decoration-white/40 underline-offset-2 hover:text-[var(--color-text-on-media)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    : "rounded-sm underline decoration-[var(--color-border-strong)] underline-offset-2 hover:text-[var(--color-text-link)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

  return (
    <p className={`${textClass} ${className}`}>
      {credit.sourceUrl ? (
        <a
          href={credit.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {formatPhotoCredit(credit.author, credit.licenseName)}
        </a>
      ) : (
        <span>{formatPhotoCredit(credit.author, credit.licenseName)}</span>
      )}
      {credit.licenseUrl ? (
        <a
          href={credit.licenseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`ml-1 ${linkClass}`}
        >
          License
        </a>
      ) : null}
    </p>
  );
}
