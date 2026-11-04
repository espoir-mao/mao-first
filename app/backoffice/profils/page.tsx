import { listProfileChangeRequests } from "@/app/actions/profile-requests";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import AppShell from "@/components/AppShell";
import AdminProfileQueue from "@/components/admin/AdminProfileQueue";
import type { ProfileChangeRequest } from "@/lib/profile-request";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function AdminProfilesPage() {
  const configured = isSupabaseConfigured();
  let requests: ProfileChangeRequest[] = [];
  let loadError: string | undefined;

  if (configured) {
    const result = await listProfileChangeRequests();
    if (result.success) requests = result.data ?? [];
    else loadError = result.error;
  }

  return (
    <AppShell titleKey="header.title.adminProfiles">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-8 sm:max-w-5xl sm:py-12">
        <AdminProfileQueue requests={requests} configured={configured} loadError={loadError} />
      </div>
    </AppShell>
  );
}
