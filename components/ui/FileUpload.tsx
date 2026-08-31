"use client";

import { useEffect, useRef, useState } from "react";

type FileUploadProps = {
  accept?: string;
  maxSizeMB?: number;
  value: File | null;
  onFileChange?: (file: File | null) => void;
  label?: string;
  disabled?: boolean;
  validateFile?: (file: File) => string | null;
};

export default function FileUpload({
  accept = "image/jpeg,image/png,image/webp,video/mp4,application/pdf",
  maxSizeMB = 20,
  value,
  onFileChange,
  label = "Upload a file",
  disabled = false,
  validateFile,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value || !value.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(value);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [value]);

  useEffect(() => {
    if (!value && inputRef.current) inputRef.current.value = "";
  }, [value]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);

    if (!file) {
      onFileChange?.(null);
      return;
    }

    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
      e.target.value = "";
      onFileChange?.(null);
      return;
    }
    const validationError = validateFile?.(file);
    if (validationError) {
      setError(validationError);
      e.target.value = "";
      onFileChange?.(null);
      return;
    }
    onFileChange?.(file);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <label
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-6 ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-blue-400 hover:bg-blue-50"
        }`}
      >
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="mb-2 max-h-48 rounded object-contain"
          />
        ) : value ? (
          <div className="mb-2 flex items-center gap-2 text-sm text-neutral-600">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>{value.name}</span>
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
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFile}
          disabled={disabled}
          className="hidden"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
