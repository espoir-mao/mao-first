import type { ReactNode } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import ShellGate from "./ShellGate";

interface AppShellProps {
  /** Translation key for the centered page/section title in the top bar. */
  titleKey: string;
  children: ReactNode;
}

/**
 * Shared layout for every société/visa page (list + wizard steps, for both
 * modules): the dark top `Header` bar full-width, with a persistent left
 * `Sidebar` and the page's own content below it. Not used on the
 * login/sign-up pages, which keep their own full-bleed split layout.
 */
export default function AppShell({ titleKey, children }: AppShellProps) {
  return (
    <ShellGate>
      <div className="flex min-h-screen w-full flex-col">
        <Header titleKey={titleKey} />
        <div className="flex w-full flex-1 flex-col sm:flex-row">
          <Sidebar />
          <main className="w-full flex-1">{children}</main>
        </div>
      </div>
    </ShellGate>
  );
}
