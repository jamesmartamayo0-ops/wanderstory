"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import FileUpload from "@/components/ui/FileUpload";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import MediaPickerMulti from "./MediaPickerMulti";

export type ChapterMediaItem = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  altText: string | null;
  order: number;
};

export type LibraryMediaItem = {
  id: string;
  fileName: string;
  url: string;
  thumbnailUrl: string | null;
  type: string;
  mimeType: string;
};

export type ChapterMediaActions = {
  uploadAction: (formData: FormData) => void;
  attachAction: (formData: FormData) => void;
  removeAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  reorderAction: (formData: FormData) => void;
  updateAltAction: (formData: FormData) => void;
};

type ChapterMediaSectionProps = {
  medias: ChapterMediaItem[];
  libraryMedia: LibraryMediaItem[];
  actions: ChapterMediaActions;
};

export default function ChapterMediaSection({
  medias,
  libraryMedia,
  actions,
}: ChapterMediaSectionProps) {
  const [orderIds, setOrderIds] = useState<string[]>(
    [...medias].sort((a, b) => a.order - b.order).map((m) => m.id)
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const byId = new Map(medias.map((m) => [m.id, m]));
  const orderedMedias = orderIds
    .map((id) => byId.get(id))
    .filter((m): m is ChapterMediaItem => Boolean(m));

  function move(index: number, direction: -1 | 1) {
    setOrderIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Media{" "}
          <span className="text-neutral-400">
            ({orderedMedias.length})
          </span>
        </p>
      </div>

      {orderedMedias.length === 0 ? (
        <p className="text-sm text-neutral-400">No media attached.</p>
      ) : (
        <div className="space-y-3">
          <form action={actions.reorderAction}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {orderedMedias.map((media, index) => (
                <div
                  key={media.id}
                  className="overflow-hidden rounded-lg border bg-white"
                >
                  <input
                    type="hidden"
                    name="mediaIds"
                    value={media.id}
                  />
                  <div className="aspect-video overflow-hidden bg-neutral-100">
                    <img
                      src={media.thumbnailUrl ?? media.url}
                      alt={media.altText ?? "Chapter media"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-1 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-400">
                        {index + 1} of {orderedMedias.length}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === orderedMedias.length - 1}
                          className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                      </div>
                    </div>

                    <form action={actions.updateAltAction}>
                      <input
                        type="hidden"
                        name="mediaId"
                        value={media.id}
                      />
                      <div className="flex items-center gap-1">
                        <input
                          name="altText"
                          type="text"
                          defaultValue={media.altText ?? ""}
                          placeholder="Alt text"
                          className="w-full rounded border border-neutral-200 px-1.5 py-1 text-xs"
                        />
                        <button
                          type="submit"
                          className="shrink-0 rounded border border-neutral-300 px-1.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
                        >
                          Save
                        </button>
                      </div>
                    </form>

                    <div className="flex items-center justify-between pt-1">
                      <form action={actions.removeAction}>
                        <input
                          type="hidden"
                          name="mediaId"
                          value={media.id}
                        />
                        <button
                          type="submit"
                          className="text-xs text-neutral-500 hover:text-neutral-700"
                        >
                          Remove
                        </button>
                      </form>
                      <form action={actions.deleteAction}>
                        <input
                          type="hidden"
                          name="mediaId"
                          value={media.id}
                        />
                        <ConfirmDeleteButton
                          confirmMessage="Delete this image permanently? This also removes it from Cloudinary."
                          className="text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </ConfirmDeleteButton>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="mt-2"
              disabled={orderIds.length === 0}
            >
              Save Order
            </Button>
          </form>
        </div>
      )}

      <div className="space-y-3">
        <form action={actions.attachAction} className="flex flex-wrap items-end gap-2">
          <div>
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="mediaIds" value={id} />
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              Add from Library
            </Button>
          </div>
          {selectedIds.length > 0 && (
            <Button type="submit" variant="primary" size="sm">
              Attach ({selectedIds.length})
            </Button>
          )}
        </form>

        <form action={actions.uploadAction} className="space-y-2">
          <FileUpload
            accept="image/jpeg,image/png,image/webp"
            maxSizeMB={20}
            label="Upload new image"
          />
          <Button type="submit" variant="primary" size="sm">
            Upload to Chapter
          </Button>
        </form>
      </div>

      {pickerOpen && (
        <MediaPickerMulti
          media={libraryMedia}
          selectedIds={selectedIds}
          onToggle={toggleSelected}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}