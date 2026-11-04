import LegalPage from "@/components/LegalPage";

// Items between [square brackets] are placeholders to be completed with the
// company's real registration details before going live.
const CONTENT = {
  fr: {
    heading: "Mentions légales",
    sections: [
      { title: "Éditeur du site", body: ["MAO - My Accountant Online", "Dubaï, Émirats arabes unis", "Email : contact@mao.com   Téléphone : 0978288310", "[Forme juridique, numéro de licence / immatriculation et représentant légal à compléter]"] },
      { title: "Hébergement", body: ["[Nom et adresse de l'hébergeur à compléter]"] },
      { title: "Propriété intellectuelle", body: ["Le nom MAO, le logo et les contenus de ce site sont la propriété de MAO. Toute reproduction sans autorisation écrite préalable est interdite."] },
      { title: "Responsabilité", body: ["MAO s'efforce de fournir des informations exactes et à jour mais ne peut garantir l'absence d'erreurs. L'utilisation du service se fait sous la responsabilité de l'utilisateur."] },
      { title: "Contact", body: ["Pour toute question : contact@mao.com."] },
    ],
  },
  en: {
    heading: "Legal notice",
    sections: [
      { title: "Publisher", body: ["MAO - My Accountant Online", "Dubai, United Arab Emirates", "Email: contact@mao.com   Phone: 0978288310", "[Legal form, licence / registration number and legal representative to be completed]"] },
      { title: "Hosting", body: ["[Host name and address to be completed]"] },
      { title: "Intellectual property", body: ["The MAO name, logo and the contents of this site are the property of MAO. Any reproduction without prior written permission is prohibited."] },
      { title: "Liability", body: ["MAO strives to provide accurate and up-to-date information but cannot guarantee the absence of errors. Use of the service is at the user's own responsibility."] },
      { title: "Contact", body: ["For any question: contact@mao.com."] },
    ],
  },
};

export default function Page() {
  return <LegalPage titleKey="footer.legal" content={CONTENT} />;
}
