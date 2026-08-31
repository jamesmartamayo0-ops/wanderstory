"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  finalizeMediaUpload,
  signMediaUpload,
} from "@/actions/media.actions";
import Button from "@/components/ui/Button";
import FileUpload from "@/components/ui/FileUpload";
import { useDirectMediaUpload } from "@/lib/hooks/useDirectMediaUpload";
import { getClientFileValidationError } from "@/lib/validation/media-upload.schema";

export default function UploadForm() {
  const router = useRouter();
  const onSuccess = useCallback(() => {
    router.push("/admin/media");
    router.refresh();
  }, [router]);
  const upload = useDirectMediaUpload({
    purpose: "lib",
    signAction: signMediaUpload,
    finalizeAction: finalizeMediaUpload,
    onSuccess,
  });

  const actionLabel = upload.canRetryFinalization
    ? "Retry finalization"
    : upload.status === "authorizing"
      ? "Authorizing..."
      : upload.status === "uploading"
        ? `Uploading ${upload.progress}%`
        : upload.status === "finalizing"
          ? "Finalizing..."
          : upload.status === "error" && upload.file
            ? "Retry upload"
            : "Upload";

  return (
    <div className="space-y-4">
      <FileUpload
        accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
        maxSizeMB={100}
        value={upload.file}
        onFileChange={upload.selectFile}
        validateFile={(file) => getClientFileValidationError(file, "lib")?.message ?? null}
        disabled={upload.active}
        label="Select a file to upload"
      />

      <p className="text-xs text-neutral-400">
        Allowed: JPEG, PNG, WebP (max 20MB), MP4 (max 100MB), PDF (max 20MB)
      </p>

      {upload.status === "uploading" && (
        <div className="space-y-1" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full bg-blue-600 transition-[width]"
              style={{ width: `${upload.progress}%` }}
            />
          </div>
          <p className="text-xs text-neutral-500">Uploading directly to Cloudinary: {upload.progress}%</p>
        </div>
      )}

      {upload.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          <p>{upload.error.message}</p>
          <p className="mt-1 text-xs text-red-500">Error: {upload.error.code}</p>
          {upload.error.retryAfterSeconds && (
            <p className="mt-1 text-xs">Retry in about {upload.error.retryAfterSeconds} seconds.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={upload.active || (!upload.file && !upload.canRetryFinalization)}
          onClick={() => void upload.start()}
        >
          {actionLabel}
        </Button>
        {upload.active ? (
          <Button type="button" variant="secondary" onClick={upload.cancel}>
            Cancel upload
          </Button>
        ) : (
          <Link href="/admin/media">
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
        )}
        {!upload.active && upload.file && (
          <Button type="button" variant="ghost" onClick={upload.reset}>
            Clear selection
          </Button>
        )}
      </div>
    </div>
  );
}
