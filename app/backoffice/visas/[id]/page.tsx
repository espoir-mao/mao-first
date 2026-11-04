import { notFound } from "next/navigation";
import { getCompany } from "@/app/actions/companies";
import { listCorrections } from "@/app/actions/corrections";
import { getVisaApplication } from "@/app/actions/visa";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import AppShell from "@/components/AppShell";
import VisaDossier from "@/components/backoffice/VisaDossier";
import { companyDisplayName } from "@/lib/company-view";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function VisaDossierPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) notFound();
  const visa = await getVisaApplication(params.id);
  if (!visa.success || !visa.data) notFound();

  const [company, corrections] = await Promise.all([
    visa.data.company_id ? getCompany(visa.data.company_id) : Promise.resolve(null),
    listCorrections({ visaId: params.id }),
  ]);

  return (
    <AppShell titleKey="header.title.adminDossier">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-8 sm:max-w-4xl sm:py-12">
        <VisaDossier
          visa={visa.data}
          companyName={company?.success && company.data ? companyDisplayName(company.data) : null}
          corrections={corrections.data ?? []}
        />
      </div>
    </AppShell>
  );
}
