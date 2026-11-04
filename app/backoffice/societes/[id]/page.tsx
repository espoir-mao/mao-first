import { notFound } from "next/navigation";
import { getCompany, getCompanyCatalog } from "@/app/actions/companies";
import { listCorrections } from "@/app/actions/corrections";
import { listVisaApplications } from "@/app/actions/visa";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import AppShell from "@/components/AppShell";
import CompanyDossier from "@/components/backoffice/CompanyDossier";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function CompanyDossierPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) notFound();
  const [company, catalog, corrections, visas] = await Promise.all([
    getCompany(params.id),
    getCompanyCatalog(),
    listCorrections({ companyId: params.id, companyLevelOnly: true }),
    listVisaApplications(),
  ]);
  if (!company.success || !company.data || !catalog.success || !catalog.data) notFound();

  return (
    <AppShell titleKey="header.title.adminDossier">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-8 sm:max-w-4xl sm:py-12">
        <CompanyDossier
          initial={company.data}
          catalog={catalog.data}
          corrections={corrections.data ?? []}
          visas={(visas.data ?? []).filter((v) => v.company_id === params.id)}
        />
      </div>
    </AppShell>
  );
}
