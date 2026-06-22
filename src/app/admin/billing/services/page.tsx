import { redirect } from "next/navigation";

export default function AdminServicesRedirectPage() {
  redirect("/staff/billing/services");
}
