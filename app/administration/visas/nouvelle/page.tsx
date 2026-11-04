import AppShell from "@/components/AppShell";
import VisaForm from "@/components/visa/VisaForm";
import { listCompanies } from "@/app/actions/companies";
import { isOperational } from "@/lib/company-view";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import type { CompanyFile } from "@/lib/company-types";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function NouvelleVisaPage() {
  let societes: CompanyFile[] = [];

  if (isSupabaseConfigured()) {
    const result = await listCompanies();
    if (result.success) {
      // a visa is a separate procedure, launched once the licence is issued
      societes = (result.data ?? []).filter(isOperational);
    }
  }

  return (
    <AppShell titleKey="header.title.visaCreate">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8 sm:max-w-6xl sm:py-12">
        <VisaForm societes={societes} />
      </div>
    </AppShell>
  );
}
