import AppShell from "@/components/AppShell";
import ConfigNotice from "@/components/ConfigNotice";
import CompanyWizard from "@/components/company-wizard/CompanyWizard";
import { getCompanyCatalog } from "@/app/actions/companies";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function NouvelleSocietePage() {
  const catalog = isSupabaseConfigured() ? await getCompanyCatalog() : null;
  return (
    <AppShell titleKey="header.title.create">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8 sm:max-w-6xl sm:py-12">
        {catalog?.success && catalog.data ? (
          <CompanyWizard catalog={catalog.data} />
        ) : (
          <>
            <ConfigNotice />
            {catalog && !catalog.success && <p className="text-sm text-red-500">{catalog.error}</p>}
          </>
        )}
      </div>
    </AppShell>
  );
}
