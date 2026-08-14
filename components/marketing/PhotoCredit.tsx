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
    ? "text-xs text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]"
    : "text-xs text-neutral-500";
  const linkClass = overlay
    ? "underline decoration-white/40 underline-offset-2 hover:text-white"
    : "underline decoration-neutral-300 underline-offset-2 hover:text-neutral-800";

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