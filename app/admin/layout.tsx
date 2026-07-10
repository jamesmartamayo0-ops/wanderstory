import Link from "next/link";
import { headers } from "next/headers";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "";

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-neutral-50 p-6">
        <nav className="space-y-4">
          <div className="text-lg font-bold">WanderStory</div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/admin" className="block hover:underline">
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/admin/journeys" className="block hover:underline">
                Journeys
              </Link>
            </li>
            <li>
              <Link href="/admin/clients" className="block hover:underline">
                Clients
              </Link>
            </li>
            <li>
              <Link href="/admin/media" className="block hover:underline">
                Media
              </Link>
            </li>
            <li>
              <Link href="/admin/destinations" className="block hover:underline">
                Destinations
              </Link>
            </li>
            <li>
              <Link href="/admin/categories" className="block hover:underline">
                Categories
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}