import { listCompanies } from "@/app/actions/companies";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import ChoisirSocieteClient from "@/components/choisir-societe/ChoisirSocieteClient";
import type { CompanyFile } from "@/lib/company-types";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function ChoisirSocietePage() {
  const configured = isSupabaseConfigured();

  let societes: CompanyFile[] = [];
  if (configured) {
    const result = await listCompanies();
    if (result.success) {
      societes = result.data ?? [];
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-white">
      <Header titleKey="header.title.chooseSociete" />
      <main className="w-full flex-1">
        <ChoisirSocieteClient societes={societes} />
      </main>
    </div>
  );
}
