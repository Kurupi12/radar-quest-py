import { notFound } from "next/navigation";
import {
  findBrandBySlug,
  listPublicMissionsForBrand,
  toPublicBrand,
} from "@/lib/db/store";
import { RadarGameClient } from "@/components/radar/RadarGameClient";

export const dynamic = "force-dynamic";

export default async function BrandQrClaimLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string }>;
  searchParams: Promise<{ token?: string; node?: string }>;
}) {
  const { brand: brandSlug } = await params;
  const query = await searchParams;
  const brand = await findBrandBySlug(brandSlug);

  if (!brand || !brand.active) {
    notFound();
  }

  const publicMissions = await listPublicMissionsForBrand(brand.id);
  const token = query.token || query.node || "";

  return (
    <RadarGameClient
      initialBrand={toPublicBrand(brand)}
      initialMissions={publicMissions}
      autoOpenClaimToken={token}
    />
  );
}
