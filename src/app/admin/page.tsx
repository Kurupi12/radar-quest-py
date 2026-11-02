import { hasSuperAdminAccess } from "@/lib/auth/adminAuth";
import { SuperAdminGate } from "@/components/admin/SuperAdminGate";
import { SuperAdminClient } from "@/components/admin/SuperAdminClient";

export const dynamic = "force-dynamic";

export default async function SuperAdminRootPage() {
  const authorized = await hasSuperAdminAccess();

  if (!authorized) {
    return <SuperAdminGate />;
  }

  return <SuperAdminClient />;
}

