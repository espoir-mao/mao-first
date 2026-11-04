import { listCompanies } from "@/app/actions/companies";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import SocieteSubPage from "@/components/societe/SocieteSubPage";
import IllustrationPanel from "@/components/societe/IllustrationPanel";
import AppShell from "@/components/AppShell";
import type { CompanyFile } from "@/lib/company-types";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function AProposPage() {
  const configured = isSupabaseConfigured();

  let societes: CompanyFile[] = [];
  let loadError: string | undefined;

  if (configured) {
    const result = await listCompanies();
    if (result.success) {
      societes = result.data ?? [];
    } else {
      loadError = result.error;
    }
  }

  return (
    <AppShell titleKey="header.title.about">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-8 sm:max-w-6xl sm:py-12">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr] lg:gap-10">
          <IllustrationPanel
            chip1Key="list.illustration.chip1"
            titleKey="list.illustration.title"
            bodyKey="list.illustration.body"
          />

          <SocieteSubPage
            panel="about"
            initialSocietes={societes}
            configured={configured}
            loadError={loadError}
          />
        </div>
      </div>
    </AppShell>
  );
}
