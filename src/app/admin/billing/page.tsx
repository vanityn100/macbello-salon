import { redirect } from "next/navigation";

export default function AdminBillingRedirectPage() {
  redirect("/staff/billing");
}
