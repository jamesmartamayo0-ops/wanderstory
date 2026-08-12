"use client";

import { useActionState, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import type { ActionResult } from "@/types";

type TimelineEventItem = {
  id: string;
  date: string | Date;
  title: string;
  description: string | null;
  order: number;
};

type TimelineEditorProps = {
  events: TimelineEventItem[];
  createAction: (formData: FormData) => Promise<ActionResult>;
  updateAction: (formData: FormData) => Promise<ActionResult>;
  deleteAction: (formData: FormData) => Promise<ActionResult>;
  reorderAction: (formData: FormData) => Promise<ActionResult>;
};

const initialState: ActionResult = { success: true };

function toDateInputValue(date: string | Date): string {
  return new Date(date).toISOString().split("T")[0];
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FormErrors({ state }: { state: ActionResult }) {
  if (state.success) return null;
  return (
    <div className="space-y-1">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.fieldErrors &&
        Object.entries(state.fieldErrors).map(([field, messages]) =>
          messages.map((message, index) => (
            <p key={`${field}-${index}`} className="text-sm text-red-600">
              {field}: {message}
            </p>
          ))
        )}
    </div>
  );
}

export default function TimelineEditor({
  events,
  createAction,
  updateAction,
  deleteAction,
  reorderAction,
}: TimelineEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [orderIds, setOrderIds] = useState<string[]>(
    [...events].sort((a, b) => a.order - b.order).map((e) => e.id)
  );

  const [createState, createFormAction, createPending] = useActionState(
    (_prevState: ActionResult, formData: FormData) => createAction(formData),
    initialState
  );

  const byId = new Map(events.map((e) => [e.id, e]));
  const orderedEvents = orderIds
    .map((id) => byId.get(id))
    .filter((e): e is TimelineEventItem => Boolean(e));

  function move(index: number, direction: -1 | 1) {
    setOrderIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {events.length} {events.length === 1 ? "event" : "events"}
        </p>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => {
            setShowNewForm(!showNewForm);
            setEditingId(null);
          }}
        >
          {showNewForm ? "Cancel" : "Add Event"}
        </Button>
      </div>

      {showNewForm && (
        <Card className="border border-blue-200 bg-blue-50 p-4">
          <form action={createFormAction} className="space-y-3">
            <Input
              label="Date"
              name="date"
              type="date"
              required
              error={createState.fieldErrors?.date?.[0]}
            />
            <Input
              label="Title"
              name="title"
              required
              error={createState.fieldErrors?.title?.[0]}
            />
            <Textarea label="Description" name="description" rows={3} />
            <FormErrors state={createState} />
            <Button type="submit" variant="primary" size="md" disabled={createPending}>
              {createPending ? "Saving..." : "Save Event"}
            </Button>
          </form>
        </Card>
      )}

      {orderedEvents.length === 0 && !showNewForm && (
        <p className="py-4 text-center text-sm text-neutral-400">
          No timeline events yet.
        </p>
      )}

      {orderedEvents.length > 0 && (
        <div className="space-y-3">
          {orderedEvents.map((event, index) => (
            <Card key={event.id} className="p-4">
              {editingId === event.id ? (
                <EditForm
                  event={event}
                  updateAction={updateAction}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        {formatDate(event.date)}
                      </p>
                      <h3 className="mt-1 text-sm font-medium">{event.title}</h3>
                      {event.description && (
                        <p className="mt-1 line-clamp-3 text-sm text-neutral-500">
                          {event.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(event.id);
                          setShowNewForm(false);
                        }}
                      >
                        Edit
                      </Button>
                      <DeleteEventForm
                        eventId={event.id}
                        deleteAction={deleteAction}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t pt-3">
                    <span className="text-[10px] text-neutral-400">
                      {index + 1} of {orderedEvents.length}
                    </span>
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
                      disabled={index === orderedEvents.length - 1}
                      className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {orderedEvents.length > 1 && (
        <ReorderForm orderIds={orderIds} reorderAction={reorderAction} />
      )}
    </div>
  );
}

function EditForm({
  event,
  updateAction,
  onCancel,
}: {
  event: TimelineEventItem;
  updateAction: (formData: FormData) => Promise<ActionResult>;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(toDateInputValue(event.date));
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");

  const [state, formAction, pending] = useActionState(
    (_prevState: ActionResult, formData: FormData) => updateAction(formData),
    initialState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="timelineEventId" value={event.id} />
      <Input
        label="Date"
        name="date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        error={state.fieldErrors?.date?.[0]}
      />
      <Input
        label="Title"
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        error={state.fieldErrors?.title?.[0]}
      />
      <Textarea
        label="Description"
        name="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />
      <FormErrors state={state} />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DeleteEventForm({
  eventId,
  deleteAction,
}: {
  eventId: string;
  deleteAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction] = useActionState(
    (_prevState: ActionResult, formData: FormData) => deleteAction(formData),
    initialState
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="timelineEventId" value={eventId} />
      <ConfirmDeleteButton confirmMessage="Delete this timeline event?" />
      <FormErrors state={state} />
    </form>
  );
}

function ReorderForm({
  orderIds,
  reorderAction,
}: {
  orderIds: string[];
  reorderAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, pending] = useActionState(
    (_prevState: ActionResult, formData: FormData) => reorderAction(formData),
    initialState
  );

  return (
    <form action={formAction}>
      {orderIds.map((id) => (
        <input key={id} type="hidden" name="eventIds" value={id} />
      ))}
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Save Order"}
      </Button>
      <FormErrors state={state} />
    </form>
  );
}
