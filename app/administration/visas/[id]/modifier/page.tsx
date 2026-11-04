import { CorrectionBanner } from "@/components/corrections/CompanyCorrections";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfigNotice from "@/components/ConfigNotice";
import VisaForm from "@/components/visa/VisaForm";
import { getVisaApplication } from "@/app/actions/visa";
import { listCompanies } from "@/app/actions/companies";
import { isOperational } from "@/lib/company-view";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import type { CompanyFile } from "@/lib/company-types";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

interface ModifierVisaPageProps {
  params: { id: string };
}

export default async function ModifierVisaPage({
  params,
}: ModifierVisaPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <AppShell titleKey="header.title.visaEdit">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8 sm:max-w-6xl sm:py-12">
          <ConfigNotice />
        </div>
      </AppShell>
    );
  }

  const result = await getVisaApplication(params.id);

  if (!result.success || !result.data) {
    notFound();
  }

  let societes: CompanyFile[] = [];
  const societesResult = await listCompanies();
  if (societesResult.success) {
    societes = (societesResult.data ?? []).filter(
      (s) => isOperational(s) || s.id === result.data?.company_id
    );
  }

  return (
    <AppShell titleKey="header.title.visaEdit">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8 sm:max-w-6xl sm:py-12">
        {result.data.company_id && (
          <CorrectionBanner companyId={result.data.company_id} />
        )}
        <VisaForm initial={result.data} societes={societes} />
      </div>
    </AppShell>
  );
}
