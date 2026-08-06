import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import UploadForm from "./UploadForm";

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
        <UploadForm />
      </div>
    </div>
  );
}
