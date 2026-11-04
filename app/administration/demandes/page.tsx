import { listSupportTickets } from "@/app/actions/support";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import AppShell from "@/components/AppShell";
import MesDemandesPanel from "@/components/administration/MesDemandesPanel";
import type { SupportTicket } from "@/lib/types";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function MesDemandesPage() {
  const configured = isSupabaseConfigured();

  let tickets: SupportTicket[] = [];
  let loadError: string | undefined;

  if (configured) {
    const result = await listSupportTickets();
    if (result.success) {
      tickets = result.data ?? [];
    } else {
      loadError = result.error;
    }
  }

  return (
    <AppShell titleKey="header.title.adminRequests">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-8 sm:max-w-5xl sm:py-12">
        <MesDemandesPanel
          initialTickets={tickets}
          configured={configured}
          loadError={loadError}
        />
      </div>
    </AppShell>
  );
}
