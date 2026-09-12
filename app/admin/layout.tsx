import Link from "next/link";
import { headers } from "next/headers";
import { logoutAction } from "@/actions/auth.actions";
import AdminThemeLock from "@/components/admin/AdminThemeLock";

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
    <>
      <AdminThemeLock />
      <div className="flex min-h-screen flex-col bg-white text-[#171717] [color-scheme:light] md:flex-row">
      <aside className="w-full shrink-0 border-b bg-neutral-50 p-6 md:w-64 md:border-b-0 md:border-r">
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
            <li>
              <form action={logoutAction}>
                <button type="submit" className="block hover:underline">
                  Log out
                </button>
              </form>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </>
  );
}
