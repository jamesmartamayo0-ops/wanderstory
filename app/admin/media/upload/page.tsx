import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { uploadMedia } from "@/actions/media.actions";
import Button from "@/components/ui/Button";
import FileUpload from "@/components/ui/FileUpload";

export default async function AdminMediaUploadPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/media"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Media Library
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Upload Media</h1>
      </div>

      <div className="max-w-xl rounded-lg border p-6">
        <form
          action={uploadMedia as (formData: FormData) => void}
          encType="multipart/form-data"
          className="space-y-4"
        >
          <FileUpload
            accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
            maxSizeMB={20}
            label="Select a file to upload"
          />

          <p className="text-xs text-neutral-400">
            Allowed: JPEG, PNG, WEBP (max 20MB), MP4 (max 100MB), PDF (max 20MB)
          </p>

          <div className="flex gap-3">
            <Button type="submit" variant="primary">
              Upload
            </Button>
            <Link href="/admin/media">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}