import { signIn } from "@/lib/auth";
import AdminThemeLock from "@/components/admin/AdminThemeLock";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <AdminThemeLock />
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-[#171717] [color-scheme:light]">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">WanderStory</h1>
            <p className="mt-2 text-muted-foreground">Admin sign in</p>
          </div>

          {params.error && (
            <p className="text-sm text-red-600">
              Invalid email or password
            </p>
          )}

          <LoginForm callbackUrl={params.callbackUrl} />
        </div>
      </div>
    </>
  );
}

function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        "use server";
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        await signIn("credentials", {
          email,
          password,
          redirectTo: callbackUrl ?? "/admin",
        });
      }}
    >
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800"
      >
        Sign in
      </button>
    </form>
  );
}
