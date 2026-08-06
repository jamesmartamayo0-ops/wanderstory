"use client";

import { useActionState } from "react";
import Link from "next/link";
import { uploadMedia } from "@/actions/media.actions";
import Button from "@/components/ui/Button";
import FileUpload from "@/components/ui/FileUpload";
import type { ActionResult } from "@/types";

const initialState: ActionResult = { success: true };

export default function UploadForm() {
  const [state, formAction, pending] = useActionState(
    (_prevState: ActionResult, formData: FormData) => uploadMedia(formData),
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <FileUpload
        accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
        maxSizeMB={20}
        label="Select a file to upload"
      />

      <p className="text-xs text-neutral-400">
        Allowed: JPEG, PNG, WEBP (max 20MB), MP4 (max 100MB), PDF (max 20MB)
      </p>

      {state && !state.success && state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Uploading..." : "Upload"}
        </Button>
        <Link href="/admin/media">
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
