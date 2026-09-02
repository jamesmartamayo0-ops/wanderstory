"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import { buildFacebookShareUrl } from "@/lib/social-sharing";

interface JourneyShareProps {
  title: string;
  text: string;
  url: string;
}

const subscribeToShareSupport = () => () => undefined;
const getServerShareSupport = () => false;
const getShareSupport = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.share === "function";

const controlClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2 font-[family-name:var(--font-button)] text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-accent)] hover:text-[var(--color-text-link)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] motion-reduce:transition-none";

function copyWithTemporaryTextarea(value: string): boolean {
  if (
    typeof document === "undefined" ||
    typeof document.execCommand !== "function"
  ) {
    return false;
  }

  const previouslyFocused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    previouslyFocused?.focus();
  }
}

export default function JourneyShare({ title, text, url }: JourneyShareProps) {
  const [status, setStatus] = useState("");
  const [showManualCopy, setShowManualCopy] = useState(false);
  const manualCopyRef = useRef<HTMLInputElement>(null);
  const canUseNativeShare = useSyncExternalStore(
    subscribeToShareSupport,
    getShareSupport,
    getServerShareSupport,
  );
  const facebookShareUrl = buildFacebookShareUrl(url);

  async function handleNativeShare() {
    if (typeof navigator.share !== "function") return;

    setStatus("");

    try {
      await navigator.share({ title, text, url });
      setStatus("Shared.");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AbortError"
      ) {
        return;
      }

      setStatus("Sharing isn’t available. Copy the link instead.");
    }
  }

  async function handleCopy() {
    setStatus("");

    try {
      if (typeof navigator.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(url);
        setShowManualCopy(false);
        setStatus("Link copied.");
        return;
      }
    } catch {
      // Continue to the dependency-free fallback.
    }

    if (copyWithTemporaryTextarea(url)) {
      setShowManualCopy(false);
      setStatus("Link copied.");
      return;
    }

    setShowManualCopy(true);
    setStatus("Couldn’t copy the link. Copy it manually below.");
    window.requestAnimationFrame(() => {
      manualCopyRef.current?.focus();
      manualCopyRef.current?.select();
    });
  }

  return (
    <section
      aria-label="Share this journey"
      className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <p className="mr-1 font-[family-name:var(--font-heading)] text-sm font-semibold text-[var(--color-text-primary)]">
          Share this journey
        </p>

        <div className="flex flex-wrap gap-2">
          {canUseNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className={controlClassName}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className={controlClassName}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy link
          </button>

          <a
            href={facebookShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={controlClassName}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Facebook
          </a>
        </div>

        <p
          aria-live="polite"
          className="min-h-5 basis-full font-[family-name:var(--font-body)] text-sm text-[var(--color-text-secondary)]"
        >
          {status}
        </p>

        {showManualCopy && (
          <div className="basis-full">
            <label
              htmlFor="journey-share-url"
              className="mb-2 block font-[family-name:var(--font-body)] text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Journey link
            </label>
            <input
              ref={manualCopyRef}
              id="journey-share-url"
              type="url"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-11 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 font-[family-name:var(--font-body)] text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            />
          </div>
        )}
      </div>
    </section>
  );
}
