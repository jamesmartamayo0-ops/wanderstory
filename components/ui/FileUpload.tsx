"use client";

import { useState } from "react";

type FileUploadProps = {
  accept?: string;
  maxSizeMB?: number;
  onFileChange?: (file: File | null) => void;
  label?: string;
};

export default function FileUpload({
  accept = "image/jpeg,image/png,image/webp,video/mp4,application/pdf",
  maxSizeMB = 20,
  onFileChange,
  label = "Upload a file",
}: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);

    if (!file) {
      setPreview(null);
      setFileName(null);
      onFileChange?.(null);
      return;
    }

    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
      setPreview(null);
      setFileName(null);
      onFileChange?.(null);
      return;
    }

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    setFileName(file.name);
    onFileChange?.(file);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-6 hover:border-blue-400 hover:bg-blue-50">
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="mb-2 max-h-48 rounded object-contain"
          />
        ) : fileName ? (
          <div className="mb-2 flex items-center gap-2 text-sm text-neutral-600">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>{fileName}</span>
          </div>
        ) : (
          <>
            <svg className="mb-2 h-10 w-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-neutral-500">
              <span className="font-medium text-blue-600">Click to upload</span>{" "}
              or drag and drop
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {accept.replace(/,/g, ", ")} (max {maxSizeMB}MB)
            </p>
          </>
        )}
        <input
          type="file"
          accept={accept}
          onChange={handleFile}
          className="hidden"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}