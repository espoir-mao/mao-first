import { redirect } from "next/navigation";

/**
 * "/backoffice" has no content of its own — it always redirects to its
 * first sub-page, same idea as the Sociétés/Visas sidebar entries always
 * landing on a specific route.
 */
export default function BackofficePage() {
  redirect("/backoffice/societes");
}
