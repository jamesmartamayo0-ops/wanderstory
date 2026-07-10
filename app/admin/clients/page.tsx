import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import * as clientService from "@/services/client.service";
import { createClient, updateClient, deleteClient } from "@/actions/client.actions";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const clients = await clientService.getAllClients();

  if (params.new) {
    return <CreateClientForm />;
  }

  if (params.edit) {
    const client = await clientService.getClientById(params.edit);
    if (!client) {
      return <ClientList clients={clients} />;
    }
    return <EditClientForm client={client} />;
  }

  return <ClientList clients={clients} />;
}

async function ClientList({
  clients,
}: {
  clients: Awaited<ReturnType<typeof clientService.getAllClients>>;
}) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link href="/admin/clients?new=true">
          <Button type="button" variant="primary">Add Client</Button>
        </Link>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Add your first client to get started."
       actionLabel="Add Client"
          actionHref="/admin/clients?new=true"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Phone</th>
                <th className="px-4 py-3 text-center font-medium">Journeys</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">{client.name}</td>
                  <td className="px-4 py-3 text-neutral-500">
                    {client.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {client.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="default">
                      {client._count.journeys}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <a
                        href={`/admin/clients?edit=${client.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Edit
                      </a>
                      <form action={deleteClient.bind(null, client.id) as unknown as (formData: FormData) => void}>
                        <button
                          type="submit"
                          className="text-sm text-red-600 hover:underline"
                          onClick={(e) => {
                            if (
                              !confirm(
                                "Are you sure you want to delete this client?"
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

async function CreateClientForm() {
  return (
    <div>
      <div className="mb-6">
        <a
          href="/admin/clients"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to clients
        </a>
        <h1 className="mt-2 text-2xl font-bold">Add Client</h1>
      </div>

      <div className="max-w-lg rounded-lg border p-6">
        <form action={createClient as unknown as (formData: FormData) => void} className="space-y-4">
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
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="text"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <a href="/admin/clients">
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

async function EditClientForm({
  client,
}: {
  client: NonNullable<Awaited<ReturnType<typeof clientService.getClientById>>>;
}) {
  return (
    <div>
      <div className="mb-6">
        <a
          href="/admin/clients"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to clients
        </a>
        <h1 className="mt-2 text-2xl font-bold">Edit Client</h1>
      </div>

      <div className="max-w-lg rounded-lg border p-6">
        <form
          action={updateClient.bind(null, client.id) as unknown as (formData: FormData) => void}
          className="space-y-4"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={client.name}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={client.email ?? ""}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="text"
              defaultValue={client.phone ?? ""}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={client.notes ?? ""}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <a href="/admin/clients">
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