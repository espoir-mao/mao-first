import { listDevRequests } from "@/app/actions/dev-requests";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import AppShell from "@/components/AppShell";
import DevRequestsPanel from "@/components/support/DevRequestsPanel";
import type { DevRequest } from "@/lib/dev-request";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

/** Backoffice only: requests made to the development team. */
export default async function SupportPage() {
  const configured = isSupabaseConfigured();

  let requests: DevRequest[] = [];
  let loadError: string | undefined;

  if (configured) {
    const result = await listDevRequests();
    if (result.success) requests = result.data ?? [];
    else loadError = result.error;
  }

  return (
    <AppShell titleKey="header.title.support">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-8 sm:max-w-5xl sm:py-12">
        <DevRequestsPanel initialRequests={requests} configured={configured} loadError={loadError} />
      </div>
    </AppShell>
  );
}
