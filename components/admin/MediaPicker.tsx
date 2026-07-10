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

type MediaPickerProps = {
  media: MediaItem[];
  selectedId?: string | null;
  onSelect: (media: MediaItem | null) => void;
  typeFilter?: string;
};

export default function MediaPicker({
  media,
  selectedId,
  onSelect,
  typeFilter,
}: MediaPickerProps) {
  const [search, setSearch] = useState("");

  const filtered = media.filter((item) => {
    if (typeFilter && item.type !== typeFilter) return false;
    if (search && !item.fileName.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
      />

      <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              onSelect(selectedId === item.id ? null : item)
            }
            className={`relative aspect-square overflow-hidden rounded-lg border-2 ${
              selectedId === item.id
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
  );
}