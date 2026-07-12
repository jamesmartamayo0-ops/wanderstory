import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as journeyService from "@/services/journey.service";
import * as clientService from "@/services/client.service";
import * as destinationService from "@/services/destination.service";
import * as categoryService from "@/services/category.service";
import * as mediaService from "@/services/media.service";
import {
  updateJourney,
  updateJourneyStatus,
  updatePublicationConsent,
} from "@/actions/journey.actions";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import MediaSelectField from "@/components/admin/MediaSelectField";

const statusColors: Record<string, "draft" | "review" | "approved" | "published" | "archived" | "default"> = {
  DRAFT: "draft",
  REVIEW: "review",
  APPROVED: "approved",
  PUBLISHED: "published",
  ARCHIVED: "archived",
};

export default async function JourneyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const journey = await journeyService.getJourneyById(id);

  if (!journey) {
    notFound();
  }

  const [clients, destinations, categories, media] = await Promise.all([
    clientService.getAllClients(),
    destinationService.getAllDestinations(),
    categoryService.getAllCategories(),
    mediaService.getAllMedia({ type: "IMAGE" as const }),
  ]);

  const availableTransitions: Record<string, string[]> = {
    DRAFT: ["REVIEW"],
    REVIEW: ["DRAFT", "APPROVED"],
    APPROVED: ["PUBLISHED"],
    PUBLISHED: ["ARCHIVED"],
    ARCHIVED: [],
  };

  const transitions = availableTransitions[journey.status] || [];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/journeys"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to journeys
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{journey.title}</h1>
          <Badge variant={statusColors[journey.status] || "default"}>
            {journey.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold">Journey Details</h2>
            <form
              action={updateJourney.bind(null, id) as (formData: FormData) => void}
              className="space-y-4"
            >
              <div>
                <label htmlFor="title" className="block text-sm font-medium">
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  defaultValue={journey.title}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="travelerName"
                  className="block text-sm font-medium"
                >
                  Traveler Name
                </label>
                <input
                  id="travelerName"
                  name="travelerName"
                  type="text"
                  defaultValue={journey.travelerName}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="travelStartDate"
                    className="block text-sm font-medium"
                  >
                    Start Date
                  </label>
                  <input
                    id="travelStartDate"
                    name="travelStartDate"
                    type="date"
                    defaultValue={
                      journey.travelStartDate
                        ? new Date(journey.travelStartDate)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                    className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="travelEndDate"
                    className="block text-sm font-medium"
                  >
                    End Date
                  </label>
                  <input
                    id="travelEndDate"
                    name="travelEndDate"
                    type="date"
                    defaultValue={
                      journey.travelEndDate
                        ? new Date(journey.travelEndDate)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                    className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="introduction"
                  className="block text-sm font-medium"
                >
                  Introduction
                </label>
                <textarea
                  id="introduction"
                  name="introduction"
                  rows={4}
                  defaultValue={journey.introduction ?? ""}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="clientId"
                  className="block text-sm font-medium"
                >
                  Client
                </label>
                <select
                  id="clientId"
                  name="clientId"
                  defaultValue={journey.clientId ?? ""}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="destinationId"
                  className="block text-sm font-medium"
                >
                  Destination
                </label>
                <select
                  id="destinationId"
                  name="destinationId"
                  defaultValue={journey.destinationId ?? ""}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a destination</option>
                  {destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.name}, {destination.country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Categories</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const isSelected = journey.categories.some(
                      (jc) => jc.categoryId === category.id
                    );
                    return (
                      <label
                        key={category.id}
                        className="flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="categoryIds"
                          value={category.id}
                          defaultChecked={isSelected}
                        />
                        {category.name}
                      </label>
                    );
                  })}
                  {categories.length === 0 && (
                    <p className="text-sm text-neutral-500">
                      No categories available.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <MediaSelectField
                  media={media}
                  selectedId={journey.coverMedia?.id}
                  inputName="coverMediaId"
                  label="Cover Image"
                  typeFilter="IMAGE"
                />
                <MediaSelectField
                  media={media}
                  selectedId={journey.ogImage?.id}
                  inputName="ogImageId"
                  label="OG Image"
                  typeFilter="IMAGE"
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" variant="primary">
                  Save Changes
                </Button>
                <Link href="/admin/journeys">
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold">Status</h2>
            <p className="mb-4 text-sm text-neutral-500">
              Current: <Badge variant={statusColors[journey.status] || "default"}>{journey.status}</Badge>
            </p>

            {transitions.length > 0 ? (
              <div className="space-y-2">
                {transitions.map((nextStatus) => (
                  <form
                    key={nextStatus}
                    action={updateJourneyStatus.bind(null, id) as (formData: FormData) => void}
                  >
                    <input type="hidden" name="newStatus" value={nextStatus} />
                    <button
                      type="submit"
                      className="w-full rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                    >
                      Move to {nextStatus}
                    </button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                No transitions available from {journey.status}.
              </p>
            )}
          </div>

          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold">Publication Consent</h2>
            <p className="mb-3 text-sm text-neutral-500">
              Status:{" "}
              {journey.publicationConsent?.consentGiven ? (
                <Badge variant="default">Given</Badge>
              ) : (
                <Badge variant="draft">Not Given</Badge>
              )}
            </p>

            <form
              action={updatePublicationConsent.bind(null, id) as (formData: FormData) => void}
            >
              <div className="space-y-3">
                <div>
                  <label htmlFor="consentClientId" className="block text-sm font-medium">
                    Client
                  </label>
                  <select
                    id="consentClientId"
                    name="consentClientId"
                    defaultValue={journey.publicationConsent?.clientId ?? journey.clientId}
                    className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select a client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="consentGiven"
                    value="true"
                    defaultChecked={journey.publicationConsent?.consentGiven ?? false}
                    className="rounded border-neutral-300"
                  />
                  Consent given
                </label>

                <div>
                  <label htmlFor="consentNotes" className="block text-sm font-medium">
                    Notes
                  </label>
                  <textarea
                    id="consentNotes"
                    name="consentNotes"
                    rows={2}
                    defaultValue={journey.publicationConsent?.notes ?? ""}
                    className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>

                <Button type="submit" variant="primary">
                  Save Consent
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold">Content</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Chapters</span>
                <span>{journey.chapters.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Timeline Events</span>
                <span>{journey.timelineEvents.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Quotes</span>
                <span>{journey.quotes.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Media</span>
                <span>{journey.media.length}</span>
              </div>
            </div>
          </div>

          {journey.publishedAt && (
            <div className="rounded-lg border p-6">
              <h2 className="mb-2 text-lg font-semibold">Published</h2>
              <p className="text-sm text-neutral-500">
                {new Date(journey.publishedAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}