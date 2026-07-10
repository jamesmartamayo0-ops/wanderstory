"use client";

import { useState } from "react";
import MediaPicker from "./MediaPicker";

type MediaItem = {
  id: string;
  fileName: string;
  url: string;
  thumbnailUrl: string | null;
  type: string;
  mimeType: string;
};

type MediaSelectFieldProps = {
  media: MediaItem[];
  selectedId?: string | null;
  inputName: string;
  label: string;
  typeFilter?: string;
};

export default function MediaSelectField({
  media,
  selectedId,
  inputName,
  label,
  typeFilter = "IMAGE",
}: MediaSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(
    selectedId ?? null
  );

  const selected = media.find((m) => m.id === currentId);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <input type="hidden" name={inputName} value={currentId ?? ""} />

      <div className="flex items-center gap-3">
        {selected ? (
          <div className="flex items-center gap-3">
            <div className="h-16 w-24 overflow-hidden rounded border bg-neutral-100">
              {selected.type === "IMAGE" ? (
                <img
                  src={selected.thumbnailUrl ?? selected.url}
                  alt={selected.fileName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                  {selected.type}
                </div>
              )}
            </div>
            <div className="text-sm">
              <p className="font-medium">{selected.fileName}</p>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="text-blue-600 hover:underline"
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border border-dashed border-neutral-300 px-4 py-2 text-sm text-neutral-500 hover:border-blue-400 hover:text-blue-600"
          >
            Select {label}
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Select {label}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-neutral-500 hover:text-neutral-700"
              >
                Close
              </button>
            </div>
            <MediaPicker
              media={media}
              selectedId={currentId}
              onSelect={(m) => {
                setCurrentId(m?.id ?? null);
                setOpen(false);
              }}
              typeFilter={typeFilter}
            />
          </div>
        </div>
      )}
    </div>
  );
}