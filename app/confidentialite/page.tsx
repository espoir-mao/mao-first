import LegalPage from "@/components/LegalPage";

// Items between [square brackets] are placeholders to be completed (and the
// whole text reviewed by a legal advisor) before going live.
const CONTENT = {
  fr: {
    heading: "Politique de confidentialité",
    sections: [
      { title: "Données collectées", body: ["Lors de l'utilisation du service, nous collectons les informations que vous nous fournissez : identité, adresse email, téléphone, société, documents liés à vos dossiers de société et de visa, ainsi que le contenu des messages envoyés via « Nous contacter »."] },
      { title: "Finalités", body: ["Ces données servent à gérer vos dossiers, répondre à vos demandes, assurer le fonctionnement et la sécurité du service."] },
      { title: "Destinataires", body: ["Les données sont accessibles à l'équipe MAO habilitée et à nos prestataires techniques (hébergement, envoi d'emails). Elles ne sont pas vendues."] },
      { title: "Durée de conservation", body: ["[Durée de conservation à compléter]"] },
      { title: "Vos droits", body: ["Vous pouvez demander l'accès, la rectification ou la suppression de vos données en écrivant à contact@mao.com."] },
    ],
  },
  en: {
    heading: "Privacy policy",
    sections: [
      { title: "Data we collect", body: ["When you use the service we collect the information you provide: identity, email address, phone, company, documents related to your company and visa files, and the content of messages sent through \"Contact us\"."] },
      { title: "Purposes", body: ["This data is used to manage your files, answer your requests and ensure the operation and security of the service."] },
      { title: "Recipients", body: ["Data is accessible to authorised MAO staff and our technical providers (hosting, email sending). It is not sold."] },
      { title: "Retention", body: ["[Retention period to be completed]"] },
      { title: "Your rights", body: ["You can request access, correction or deletion of your data by writing to contact@mao.com."] },
    ],
  },
};

export default function Page() {
  return <LegalPage titleKey="footer.privacy" content={CONTENT} />;
}
