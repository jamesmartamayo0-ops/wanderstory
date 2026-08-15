"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import ChapterMediaSection, {
  type ChapterMediaItem,
  type ChapterMediaActions,
  type LibraryMediaItem,
} from "./ChapterMediaSection";

type Chapter = {
  id: string;
  title: string;
  content: string;
  location: string | null;
  order: number;
  media: ChapterMediaItem[];
};

type ChapterEditorProps = {
  chapters: Chapter[];
  createAction: (formData: FormData) => void;
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  libraryMedia: LibraryMediaItem[];
  mediaActions: Record<string, ChapterMediaActions>;
};

export default function ChapterEditor({
  chapters,
  createAction,
  updateAction,
  deleteAction,
  libraryMedia,
  mediaActions,
}: ChapterEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
        </p>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setShowNewForm(!showNewForm)}
        >
          {showNewForm ? "Cancel" : "Add Chapter"}
        </Button>
      </div>

      {showNewForm && (
        <Card className="border border-blue-200 bg-blue-50 p-4">
          <form action={createAction} className="space-y-3">
            <Input label="Title" name="title" required />
            <Textarea label="Content" name="content" rows={4} required />
            <div>
              <Input
                label="Where this happens"
                name="location"
                placeholder="e.g. Boracay, White Beach"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Optional — the specific place this story is about (e.g. Boracay, White Beach).
              </p>
            </div>
            <Button type="submit" variant="primary" size="md">
              Save Chapter
            </Button>
          </form>
        </Card>
      )}

      {chapters.length === 0 && !showNewForm && (
        <p className="py-4 text-center text-sm text-neutral-400">
          No chapters yet.
        </p>
      )}

      <div className="space-y-3">
        {chapters.map((chapter) => (
          <Card key={chapter.id} className="p-4">
            {editingId === chapter.id ? (
              <EditForm
                chapter={chapter}
                updateAction={updateAction}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium">{chapter.title}</h3>
                    {chapter.location && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {chapter.location}
                      </p>
                    )}
                    <p className="mt-1 line-clamp-3 text-sm text-neutral-500">
                      {chapter.content}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(chapter.id);
                        setShowNewForm(false);
                      }}
                    >
                      Edit
                    </Button>
                    <form action={deleteAction}>
                      <input
                        type="hidden"
                        name="chapterId"
                        value={chapter.id}
                      />
                      <ConfirmDeleteButton confirmMessage="Delete this chapter?" />
                    </form>
                  </div>
                </div>

                <ChapterMediaSection
                  key={chapter.media.map((m) => m.id).join("|")}
                  medias={chapter.media}
                  libraryMedia={libraryMedia}
                  actions={mediaActions[chapter.id]}
                />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function EditForm({
  chapter,
  updateAction,
  onCancel,
}: {
  chapter: Chapter;
  updateAction: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content);
  const [location, setLocation] = useState(chapter.location ?? "");

  return (
    <form action={updateAction} className="space-y-3">
      <input type="hidden" name="chapterId" value={chapter.id} />
      <Input
        label="Title"
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <Textarea
        label="Content"
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        required
      />
      <div>
        <Input
          label="Where this happens"
          name="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Boracay, White Beach"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Optional — the specific place this story is about (e.g. Boracay, White Beach).
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm">
          Save
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}