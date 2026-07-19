import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import * as destinationService from "@/services/destination.service";
import * as mediaService from "@/services/media.service";
import {
  saveDestination,
  deleteDestination,
  updateDestinationPublished,
} from "@/actions/destination.actions";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import MediaSelectField from "@/components/admin/MediaSelectField";

export default async function AdminDestinationsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const destinations = await destinationService.getAllDestinations();

  if (params.new) {
    return <CreateDestinationForm />;
  }

  if (params.edit) {
    const destination = await destinationService.getDestinationById(params.edit);
    if (!destination) {
      return <DestinationList destinations={destinations} />;
    }
    return <EditDestinationForm destination={destination} />;
  }

  return <DestinationList destinations={destinations} />;
}

async function DestinationList({
  destinations,
}: {
  destinations: Awaited<
    ReturnType<typeof destinationService.getAllDestinations>
  >;
}) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Destinations</h1>
        <Link href="/admin/destinations?new=true">
          <Button type="button" variant="primary">
            Add Destination
          </Button>
        </Link>
      </div>

      {destinations.length === 0 ? (
        <EmptyState
          title="No destinations yet"
          description="Add your first destination to get started."
          actionLabel="Add Destination"
          actionHref="/admin/destinations?new=true"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Country</th>
                <th className="px-4 py-3 text-left font-medium">Region</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-center font-medium">Featured</th>
                <th className="px-4 py-3 text-center font-medium">Journeys</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {destinations.map((destination) => (
                <tr key={destination.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">{destination.name}</td>
                  <td className="px-4 py-3 text-neutral-500">
                    {destination.country}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {destination.region || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={destination.published ? "published" : "draft"}>
                      {destination.published ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {destination.featured ? "★" : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="default">
                      {destination._count.journeys}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <form
                        action={updateDestinationPublished.bind(
                          null,
                          destination.id,
                          !destination.published
                        ) as unknown as (formData: FormData) => void}
                      >
                        <button
                          type="submit"
                          className={`text-sm hover:underline ${
                            destination.published
                              ? "text-amber-600"
                              : "text-green-600"
                          }`}
                        >
                          {destination.published ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                      <a
                        href={`/admin/destinations?edit=${destination.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Edit
                      </a>
                      <form action={deleteDestination.bind(null, destination.id) as unknown as (formData: FormData) => void}>
                        <button
                          type="submit"
                          className="text-sm text-red-600 hover:underline"
                          onClick={(e) => {
                            if (
                              !confirm(
                                "Are you sure you want to delete this destination?"
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Delete
                        </button>
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

async function CreateDestinationForm() {
  return (
    <div>
      <div className="mb-6">
        <a
          href="/admin/destinations"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to destinations
        </a>
        <h1 className="mt-2 text-2xl font-bold">Add Destination</h1>
      </div>

      <div className="max-w-lg rounded-lg border p-6">
        <form action={saveDestination as unknown as (formData: FormData) => void} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="country" className="block text-sm font-medium">
              Country <span className="text-red-500">*</span>
            </label>
            <input
              id="country"
              name="country"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="region" className="block text-sm font-medium">
              Region
            </label>
            <input
              id="region"
              name="region"
              type="text"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="featured"
              value="true"
              className="rounded border-neutral-300"
            />
            Featured destination
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="published"
              value="true"
              className="rounded border-neutral-300"
            />
            Published
          </label>

          <div className="flex gap-3">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <a href="/admin/destinations">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

async function EditDestinationForm({
  destination,
}: {
  destination: NonNullable<
    Awaited<ReturnType<typeof destinationService.getDestinationById>>
  >;
}) {
  const media = await mediaService.getAllMedia({ type: "IMAGE" as const });

  return (
    <div>
      <div className="mb-6">
        <a
          href="/admin/destinations"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to destinations
        </a>
        <h1 className="mt-2 text-2xl font-bold">Edit Destination</h1>
      </div>

      <div className="max-w-lg rounded-lg border p-6">
        <form action={saveDestination as unknown as (formData: FormData) => void} className="space-y-4" id="edit-destination-form">
          <input type="hidden" name="id" value={destination.id} />
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={destination.name}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="country" className="block text-sm font-medium">
              Country <span className="text-red-500">*</span>
            </label>
            <input
              id="country"
              name="country"
              type="text"
              required
              defaultValue={destination.country}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="region" className="block text-sm font-medium">
              Region
            </label>
            <input
              id="region"
              name="region"
              type="text"
              defaultValue={destination.region ?? ""}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={destination.description ?? ""}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <MediaSelectField
            media={media}
            selectedId={destination.heroMedia?.id}
            inputName="heroMediaId"
            label="Hero Image"
            typeFilter="IMAGE"
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="featured"
              value="true"
              defaultChecked={destination.featured}
              className="rounded border-neutral-300"
            />
            Featured destination
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="published"
              value="true"
              defaultChecked={destination.published}
              className="rounded border-neutral-300"
            />
            Published
          </label>

          <div className="flex gap-3">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Link href="/admin/destinations">
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