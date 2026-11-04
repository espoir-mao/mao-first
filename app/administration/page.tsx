import { redirect } from "next/navigation";

/** "/administration" always lands on its first sub-page, "Gestion de demandes". */
export default function AdministrationPage() {
  redirect("/administration/demandes");
}
