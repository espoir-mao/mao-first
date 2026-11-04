import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfigNotice from "@/components/ConfigNotice";
import SuiviSociete from "@/components/societe/SuiviSociete";
import { getCompany } from "@/app/actions/companies";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

interface SuiviPageProps {
  params: { id: string };
}

/** Follow-up of a submitted creation file (step 10 of the flow, reopened later). */
export default async function SuiviSocietePage({ params }: SuiviPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <AppShell titleKey="header.title.about">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8 sm:max-w-6xl sm:py-12">
          <ConfigNotice />
        </div>
      </AppShell>
    );
  }
  const result = await getCompany(params.id);
  if (!result.success || !result.data) notFound();
  if (result.data.status === "DRAFT") redirect(`/societes/${params.id}/modifier`);
  return (
    <AppShell titleKey="header.title.about">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8 sm:max-w-3xl sm:py-12">
        <SuiviSociete initial={result.data} />
      </div>
    </AppShell>
  );
}
