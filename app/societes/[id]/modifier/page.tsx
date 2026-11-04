import { CorrectionBanner } from "@/components/corrections/CompanyCorrections";
import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfigNotice from "@/components/ConfigNotice";
import CompanyWizard from "@/components/company-wizard/CompanyWizard";
import { getCompany, getCompanyCatalog } from "@/app/actions/companies";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

interface ModifierSocietePageProps {
  params: { id: string };
}

/** Resumes a DRAFT in the creation wizard; a submitted file goes to its follow-up page. */
export default async function ModifierSocietePage({ params }: ModifierSocietePageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <AppShell titleKey="header.title.edit">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8 sm:max-w-6xl sm:py-12">
          <ConfigNotice />
        </div>
      </AppShell>
    );
  }

  const [result, catalog] = await Promise.all([getCompany(params.id), getCompanyCatalog()]);
  if (!result.success || !result.data) notFound();
  if (result.data.status !== "DRAFT") redirect(`/societes/${params.id}/suivi`);
  if (!catalog.success || !catalog.data) notFound();

  return (
    <AppShell titleKey="header.title.edit">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8 sm:max-w-6xl sm:py-12">
        <CorrectionBanner companyId={params.id} />
        <CompanyWizard catalog={catalog.data} initial={result.data} />
      </div>
    </AppShell>
  );
}
