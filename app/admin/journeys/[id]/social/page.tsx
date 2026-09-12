import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { getSocialStudioData } from "@/services/social-studio.service";
import {
  createSocialDraft,
  updateSocialDraft,
  transitionSocialDraftStatus,
  deleteSocialDraft,
} from "@/actions/social-draft.actions";
import Badge from "@/components/ui/Badge";
import SocialDraftCard from "@/components/admin/SocialDraftCard";

export default async function SocialStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "EDITOR" && role !== "SUPER_ADMIN") {
    return <p role="alert">You do not have access to Social Content.</p>;
  }

  const { id } = await params;
  const result = await getSocialStudioData(id);
  if (!result.success) {
    if (result.code === "NOT_FOUND") notFound();
    return (
      <div className="space-y-4">
        <Link href={`/admin/journeys/${id}`} className="text-blue-700 underline">Back to Journey</Link>
        <h1 className="text-2xl font-bold">Social Content</h1>
        <p role="alert">Social Content could not be loaded. {result.error} Reload this page to try again.</p>
      </div>
    );
  }

  const { data } = result;
  const capabilities = {
    create: canAccess(role, "social:create"),
    update: canAccess(role, "social:update"),
    ready: canAccess(role, "social:ready"),
    delete: canAccess(role, "social:delete"),
  };
  const actions = {
    createAction: createSocialDraft.bind(null, id),
    updateAction: updateSocialDraft.bind(null, id),
    transitionAction: transitionSocialDraftStatus.bind(null, id),
    deleteAction: deleteSocialDraft.bind(null, id),
  };
  // A read receipt lets only a card requesting Reload adopt refreshed props.
  // This is not a React key, a concurrency token, or persisted state.
  const renderId = randomUUID();

  return (
    <div className="min-w-0 space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href={`/admin/journeys/${id}`} className="text-blue-700 underline focus-visible:outline-2 focus-visible:outline-offset-2">Back to Journey</Link>
          {data.publicJourneyUrl && (
            <a href={data.publicJourneyUrl} className="text-blue-700 underline focus-visible:outline-2 focus-visible:outline-offset-2">View public Journey</a>
          )}
        </div>
        <h1 className="break-words text-2xl font-bold">Social Content</h1>
        <h2 className="break-words text-xl font-semibold">{data.journey.title}</h2>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div><dt className="inline">Journey status: </dt><dd className="inline"><Badge>{data.journey.status}</Badge></dd></div>
          <div><dt className="inline">Visibility: </dt><dd className="inline">{data.journey.visibility}</dd></div>
          <div><dt className="inline">Publication consent: </dt><dd className="inline">{data.journey.publicationConsentGiven ? "Given" : "Not given"}</dd></div>
        </dl>
      </header>
      {data.journey.status === "ARCHIVED" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3" role="status">This Journey is archived. Social drafts are read-only.</p>
      )}
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-2">
        {(["FACEBOOK", "INSTAGRAM"] as const).map((platform) => (
          <SocialDraftCard
            key={platform}
            platform={platform}
            entry={data.drafts.find((entry) => entry.draft.platform === platform) ?? null}
            renderId={renderId}
            journeyStatus={data.journey.status}
            media={data.media}
            defaultPreview={data.defaultPreview}
            capabilities={capabilities}
            {...actions}
          />
        ))}
      </div>
    </div>
  );
}
