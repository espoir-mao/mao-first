import { listCompanies } from "@/app/actions/companies";
import { listSupportTickets } from "@/app/actions/support";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import AppShell from "@/components/AppShell";
import AdminLicenseQueue, {
  type LicenseHistoryRow,
} from "@/components/admin/AdminLicenseQueue";
import type { CompanyFile } from "@/lib/company-types";
import { companyDisplayName } from "@/lib/company-view";
import type { SupportTicket } from "@/lib/types";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function AdminLicensesPage() {
  const configured = isSupabaseConfigured();

  let pendingAttribution: CompanyFile[] = [];
  let renewalTickets: SupportTicket[] = [];
  let historyRows: LicenseHistoryRow[] = [];
  let loadError: string | undefined;

  if (configured) {
    const [societesResult, ticketsResult] = await Promise.all([
      listCompanies(),
      listSupportTickets(),
    ]);

    if (societesResult.success) {
      const societes = societesResult.data ?? [];

      pendingAttribution = societes.filter(
        (s) => s.status === "INITIAL_APPROVAL" && !s.licence_number
      );

      historyRows = societes
        .flatMap((s) =>
          (s.licence_history ?? []).map((entry) => ({
            societeId: s.id,
            societeName: companyDisplayName(s) ?? s.id,
            action: entry.action,
            number: entry.number,
            type: entry.type,
            expires_at: entry.expires_at,
            changed_at: entry.changed_at,
          }))
        )
        .sort((a, b) => b.changed_at.localeCompare(a.changed_at));
    } else {
      loadError = societesResult.error;
    }

    if (ticketsResult.success) {
      renewalTickets = (ticketsResult.data ?? []).filter(
        (tk) => tk.type === "license_renewal" && tk.status === "ouvert"
      );
    } else if (!loadError) {
      loadError = ticketsResult.error;
    }
  }

  return (
    <AppShell titleKey="header.title.adminLicenses">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-8 sm:max-w-5xl sm:py-12">
        <AdminLicenseQueue
          pendingAttribution={pendingAttribution}
          renewalTickets={renewalTickets}
          historyRows={historyRows}
          configured={configured}
          loadError={loadError}
        />
      </div>
    </AppShell>
  );
}
