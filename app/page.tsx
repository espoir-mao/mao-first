import { listCompanies } from "@/app/actions/companies";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import SocieteHome from "@/components/societe/SocieteHome";
import { listVisaApplications } from "@/app/actions/visa";
import { listSupportTickets } from "@/app/actions/support";
import type { SupportTicket } from "@/lib/types";
import type { VisaApplication } from "@/lib/visa-types";
import HomeGate from "@/components/landing/HomeGate";
import AppShell from "@/components/AppShell";
import type { CompanyFile } from "@/lib/company-types";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const configured = isSupabaseConfigured();

  let societes: CompanyFile[] = [];
  let loadError: string | undefined;
  let visas: VisaApplication[] = [];
  let tickets: SupportTicket[] = [];

  if (configured) {
    const result = await listCompanies();
    if (result.success) {
      societes = result.data ?? [];
    } else {
      loadError = result.error;
    }
    const [v, tk] = await Promise.all([listVisaApplications(), listSupportTickets()]);
    if (v.success) visas = v.data ?? [];
    if (tk.success) tickets = tk.data ?? [];
  }

  return (
    <HomeGate>
    <AppShell titleKey="header.title.list">
      <SocieteHome
        initialSocietes={societes}
        configured={configured}
        loadError={loadError}
        visas={visas}
        tickets={tickets}
      />
    </AppShell>
    </HomeGate>
  );
}
