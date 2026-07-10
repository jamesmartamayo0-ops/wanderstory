import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome back, {session.user.name}
      </p>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Journeys</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage stories and editorial content
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Clients</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage traveler contact records
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Media</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and manage uploaded assets
          </p>
        </div>
      </div>
    </div>
  );
}