import { NextResponse } from "next/server";
import { listActiveBrandsWithPublicMissions } from "@/lib/db/store";

export async function GET() {
  const brands = await listActiveBrandsWithPublicMissions();
  return NextResponse.json({ ok: true, brands });
}
