import type { Metadata } from "next";
import "./globals.css";
import LanguageProvider from "@/components/LanguageProvider";
import ThemeProvider from "@/components/ThemeProvider";
import Footer from "@/components/Footer";
import ProfileProvider from "@/components/ProfileProvider";

export const metadata: Metadata = {
  title: "MAO",
  description:
    "Créez et gérez vos sociétés aux Émirats arabes unis avec Supabase.",
};

// Applied before hydration so a stored "dark" preference doesn't flash as
// light for a frame — ThemeProvider (client) takes over from here.
const noFlashThemeScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("mao.theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashThemeScript }} />
      </head>
      <body className="bg-white text-neutral-900 antialiased dark:bg-[#12140d] dark:text-[#eef2e6]">
        <ThemeProvider>
          <LanguageProvider>
            <ProfileProvider>
              {children}
              <Footer />
            </ProfileProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
