import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import * as journeyService from "@/services/journey.service";
import * as clientService from "@/services/client.service";
import * as destinationService from "@/services/destination.service";
import * as categoryService from "@/services/category.service";
import {
  createJourney,
  deleteJourney,
  toggleJourneyFeatured,
} from "@/actions/journey.actions";
import Button from "@/components/ui/Button";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

const statusColors: Record<string, "draft" | "review" | "approved" | "published" | "archived" | "default"> = {
  DRAFT: "draft",
  REVIEW: "review",
  APPROVED: "approved",
  PUBLISHED: "published",
  ARCHIVED: "archived",
};

export default async function AdminJourneysPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const params = await searchParams;

  if (params.new) {
    return <CreateJourneyForm />;
  }

  const filters: journeyService.JourneyFilters = {};
  if (params.status && ["DRAFT", "REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"].includes(params.status)) {
    filters.status = params.status as journeyService.JourneyFilters["status"];
  }

  const journeys = await journeyService.getAllJourneys(filters);

  return <JourneyList journeys={journeys} currentStatus={params.status} />;
}

async function JourneyList({
  journeys,
  currentStatus,
}: {
  journeys: Awaited<ReturnType<typeof journeyService.getAllJourneys>>;
  currentStatus?: string;
}) {
  const statuses = ["DRAFT", "REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Journeys</h1>
        <Link href="/admin/journeys?new=true">
          <Button type="button" variant="primary">
            Add Journey
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex gap-2">
        <Link
          href="/admin/journeys"
          className={`rounded-md px-3 py-1.5 text-sm ${
            !currentStatus ? "bg-blue-100 text-blue-700" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          All
        </Link>
        {statuses.map((status) => (
          <Link
            key={status}
            href={`/admin/journeys?status=${status}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              currentStatus === status
                ? "bg-blue-100 text-blue-700"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {status}
          </Link>
        ))}
      </div>

      {journeys.length === 0 ? (
<EmptyState
  title="No journeys found"
  description={currentStatus ? `No journeys with status "${currentStatus}".` : "Create your first journey to get started."}
  actionLabel="Add Journey"
  actionHref="/admin/journeys?new=true"
/>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Traveler</th>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">Destination</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-center font-medium">Featured</th>
                <th className="px-4 py-3 text-center font-medium">Chapters</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {journeys.map((journey) => (
                <tr key={journey.id} className="hover:bg-neutral-50">
                  <td className="max-w-[200px] truncate px-4 py-3 font-medium">
                    {journey.title}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {journey.travelerName}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {journey.client?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {journey.destination?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={statusColors[journey.status] || "default"}>
                      {journey.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <form action={toggleJourneyFeatured.bind(null, journey.id) as unknown as (formData: FormData) => void}>
                      <button
                        type="submit"
                        className={`text-sm ${journey.featured ? "text-yellow-500" : "text-neutral-400"}`}
                      >
                        {journey.featured ? "★" : "☆"}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-center text-neutral-500">
                    {journey._count.chapters}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <a
                        href={`/admin/journeys/${journey.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Edit
                      </a>
                      <form action={deleteJourney.bind(null, journey.id) as unknown as (formData: FormData) => void}>
                        <ConfirmDeleteButton confirmMessage="Are you sure you want to delete this journey?" />
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function CreateJourneyForm() {
  const [clients, destinations, categories] = await Promise.all([
    clientService.getAllClients(),
    destinationService.getAllDestinations(),
    categoryService.getAllCategories(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/journeys"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to journeys
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Add Journey</h1>
      </div>

      <div className="max-w-xl rounded-lg border p-6">
        <form action={createJourney as unknown as (formData: FormData) => void} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="travelerName" className="block text-sm font-medium">
              Traveler Name <span className="text-red-500">*</span>
            </label>
            <input
              id="travelerName"
              name="travelerName"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="travelStartDate" className="block text-sm font-medium">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                id="travelStartDate"
                name="travelStartDate"
                type="date"
                required
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="travelEndDate" className="block text-sm font-medium">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                id="travelEndDate"
                name="travelEndDate"
                type="date"
                required
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="introduction" className="block text-sm font-medium">
              Introduction <span className="text-red-500">*</span>
            </label>
            <textarea
              id="introduction"
              name="introduction"
              rows={3}
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="clientId" className="block text-sm font-medium">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              id="clientId"
              name="clientId"
              required
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
            <label htmlFor="destinationId" className="block text-sm font-medium">
              Destination <span className="text-red-500">*</span>
            </label>
            <select
              id="destinationId"
              name="destinationId"
              required
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
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={category.id}
                  />
                  {category.name}
                </label>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-neutral-500">
                  No categories available.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" variant="primary">
              Create Journey
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
  );
}