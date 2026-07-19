import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDashboardStats } from "@/services/dashboard.service";
import Badge from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";
import type { JourneyStatusValue } from "@/lib/journey-transitions";

const STATUS_ORDER: JourneyStatusValue[] = [
  "DRAFT",
  "REVIEW",
  "APPROVED",
  "PUBLISHED",
  "ARCHIVED",
];

const STATUS_BADGE: Record<JourneyStatusValue, BadgeVariant> = {
  DRAFT: "draft",
  REVIEW: "review",
  APPROVED: "approved",
  PUBLISHED: "published",
  ARCHIVED: "archived",
};

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function AdminDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const stats = await getDashboardStats();

  const pipelineValues = STATUS_ORDER.map((s) => stats.journeyCounts[s] ?? 0);
  const maxCount = Math.max(...pipelineValues, 1);

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-neutral-500">
        Welcome back, {session.user.name}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-5">
        <MetricCard label="Total Journeys" value={stats.totalJourneys} />
        <MetricCard
          label="Published"
          value={stats.journeyCounts.PUBLISHED}
        />
        <MetricCard label="In Review" value={stats.journeyCounts.REVIEW} />
        <MetricCard label="Clients" value={stats.totalClients} />
        <MetricCard label="Media" value={stats.totalMedia} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Journey Pipeline</h2>
          <div className="mt-4 space-y-3">
            {STATUS_ORDER.map((status) => {
              const count = stats.journeyCounts[status] ?? 0;
              const pct = (count / maxCount) * 100;
              return (
                <div key={status} className="flex items-center gap-3">
                  <Badge variant={STATUS_BADGE[status]}>{status}</Badge>
                  <span className="w-8 text-right text-sm font-medium tabular-nums">
                    {count}
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-neutral-100">
                    <div
                      className="h-2 rounded-full bg-neutral-300 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Destinations</h2>
          <p className="mt-2 text-sm text-neutral-500">
            {stats.publishedDestinations} published /{" "}
            {stats.totalDestinations} total
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Recent Journeys</h2>
        {stats.recentJourneys.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">No journeys yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.recentJourneys.map((j) => (
                  <tr key={j.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <a
                        href={`/admin/journeys/${j.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {j.title}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[j.status]}>
                        {j.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-500">
                      {formatRelativeTime(j.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
