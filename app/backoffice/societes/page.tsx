import { listCompanies } from "@/app/actions/companies";
import { listAllCorrections } from "@/app/actions/corrections";
import type { CorrectionRequest } from "@/lib/correction";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import AppShell from "@/components/AppShell";
import AdminSocieteQueue from "@/components/admin/AdminSocieteQueue";
import type { CompanyFile } from "@/lib/company-types";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function AdminSocietesPage() {
  const configured = isSupabaseConfigured();

  let societes: CompanyFile[] = [];
  let requests: CorrectionRequest[] = [];
  let loadError: string | undefined;

  if (configured) {
    const corr = await listAllCorrections();
    if (corr.success) requests = corr.data ?? [];
    const result = await listCompanies();
    if (result.success) {
      societes = result.data ?? [];
    } else {
      loadError = result.error;
    }
  }

  return (
    <AppShell titleKey="header.title.adminSocietes">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-8 sm:max-w-5xl sm:py-12">
        <AdminSocieteQueue
          initialSocietes={societes}
          requests={requests}
          configured={configured}
          loadError={loadError}
        />
      </div>
    </AppShell>
  );
}
