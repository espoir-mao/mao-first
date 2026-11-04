import { listVisaApplications } from "@/app/actions/visa";
import { listCompanies } from "@/app/actions/companies";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import AppShell from "@/components/AppShell";
import { companyDisplayName } from "@/lib/company-view";
import AdminVisaQueue from "@/components/admin/AdminVisaQueue";
import type { VisaApplication } from "@/lib/visa-types";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function AdminVisasPage() {
  const configured = isSupabaseConfigured();

  let visas: VisaApplication[] = [];
  let societeNames: Record<string, string> = {};
  let loadError: string | undefined;

  if (configured) {
    const [visasResult, societesResult] = await Promise.all([
      listVisaApplications(),
      listCompanies(),
    ]);

    if (visasResult.success) {
      visas = visasResult.data ?? [];
    } else {
      loadError = visasResult.error;
    }

    if (societesResult.success) {
      societeNames = Object.fromEntries(
        (societesResult.data ?? []).map((s) => [s.id, companyDisplayName(s) ?? s.id])
      );
    } else if (!loadError) {
      loadError = societesResult.error;
    }
  }

  return (
    <AppShell titleKey="header.title.adminVisas">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-8 sm:max-w-5xl sm:py-12">
        <AdminVisaQueue
          initialVisas={visas}
          societeNames={societeNames}
          configured={configured}
          loadError={loadError}
        />
      </div>
    </AppShell>
  );
}
