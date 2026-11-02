import { redirect } from "next/navigation";

export default function LegacySuperAdminRedirect() {
  redirect("/admin");
}
