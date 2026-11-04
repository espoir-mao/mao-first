import { isSupabaseConfigured } from "@/lib/supabaseClient";
import AppShell from "@/components/AppShell";
import UsersPanel from "@/components/administration/UsersPanel";

export default function UtilisateursPage() {
  return (
    <AppShell titleKey="header.title.adminUsers">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-8 sm:max-w-5xl sm:py-12">
        <UsersPanel configured={isSupabaseConfigured()} />
      </div>
    </AppShell>
  );
}
