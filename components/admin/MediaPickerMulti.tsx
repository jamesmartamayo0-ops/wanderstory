"use client";

import { useState } from "react";

type MediaItem = {
  id: string;
  fileName: string;
  url: string;
  thumbnailUrl: string | null;
  type: string;
  mimeType: string;
};

type MediaPickerMultiProps = {
  media: MediaItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
};

export default function MediaPickerMulti({
  media,
  selectedIds,
  onToggle,
  onClose,
}: MediaPickerMultiProps) {
  const [search, setSearch] = useState("");

  const filtered = media.filter((item) => {
    if (search && !item.fileName.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Select Media</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-700"
          >
            Close
          </button>
        </div>

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        />

        <div className="mt-3 grid max-h-80 grid-cols-3 gap-2 overflow-y-auto">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={`relative aspect-square overflow-hidden rounded-lg border-2 ${
                selectedIds.includes(item.id)
                  ? "border-blue-500 ring-2 ring-blue-300"
                  : "border-neutral-200 hover:border-blue-300"
              }`}
            >
              {item.type === "IMAGE" ? (
                <img
                  src={item.thumbnailUrl ?? item.url}
                  alt={item.fileName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-neutral-100 text-xs text-neutral-500">
                  {item.type}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1 pb-1 pt-4 text-[10px] text-white">
                {item.fileName}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-3 py-8 text-center text-sm text-neutral-400">
              No media found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}