import { listAllCorrections } from "@/app/actions/corrections";
import { listCompanies } from "@/app/actions/companies";
import { listSupportTickets } from "@/app/actions/support";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import AppShell from "@/components/AppShell";
import AdminRequestsHub from "@/components/admin/AdminRequestsHub";
import type { CorrectionRequest } from "@/lib/correction";
import type { CompanyFile } from "@/lib/company-types";
import type { SupportTicket } from "@/lib/types";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: { company?: string; tab?: string };
}) {
  const configured = isSupabaseConfigured();
  let requests: CorrectionRequest[] = [];
  let companies: CompanyFile[] = [];
  let tickets: SupportTicket[] = [];
  let loadError: string | undefined;

  if (configured) {
    const [r, c, tk] = await Promise.all([listAllCorrections(), listCompanies(), listSupportTickets()]);
    if (r.success) requests = r.data ?? [];
    else loadError = r.error;
    if (c.success) companies = c.data ?? [];
    else loadError = loadError ?? c.error;
    if (tk.success) tickets = (tk.data ?? []).filter((x) => x.type === "contact");
    else loadError = loadError ?? tk.error;
  }

  return (
    <AppShell titleKey="header.title.adminRequests2">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-8 sm:max-w-5xl sm:py-12">
        <AdminRequestsHub
          requests={requests}
          companies={companies}
          tickets={tickets}
          initialCompanyId={searchParams.company}
          initialTab={searchParams.tab}
          configured={configured}
          loadError={loadError}
        />
      </div>
    </AppShell>
  );
}
