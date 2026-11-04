import { listVisaApplications } from "@/app/actions/visa";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import VisaPanel from "@/components/visa/VisaPanel";
import AppShell from "@/components/AppShell";
import type { VisaApplication } from "@/lib/visa-types";

// Reads live data on every request (never a build-time snapshot).
export const dynamic = "force-dynamic";

export default async function VisasPage() {
  const configured = isSupabaseConfigured();

  let visas: VisaApplication[] = [];
  let loadError: string | undefined;

  if (configured) {
    const result = await listVisaApplications();
    if (result.success) {
      visas = result.data ?? [];
    } else {
      loadError = result.error;
    }
  }

  return (
    <AppShell titleKey="header.title.visaList">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-8 sm:max-w-5xl sm:py-12">
        <VisaPanel
          initialVisas={visas}
          configured={configured}
          loadError={loadError}
        />
      </div>
    </AppShell>
  );
}
