import Header from "@/components/Header";
import ContactForm from "@/components/contact/ContactForm";

/**
 * "Nous contacter": public page (no sidebar, no account needed), reachable from
 * the header of every page and from the login / sign-up pages.
 */
export default function ContactPage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header titleKey="header.title.contact" />
      <main className="w-full flex-1 bg-neutral-100">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
          <ContactForm />
        </div>
      </main>
    </div>
  );
}
