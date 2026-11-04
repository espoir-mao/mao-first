import { redirect } from "next/navigation";

/** The history now lives on the single "/administration/visas" page. */
export default function VisaHistoryRedirect() {
  redirect("/administration/visas");
}
