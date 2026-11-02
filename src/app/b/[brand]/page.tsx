import { notFound } from "next/navigation";
import {
  findBrandBySlug,
  listPublicMissionsForBrand,
  toPublicBrand,
} from "@/lib/db/store";
import { RadarGameClient } from "@/components/radar/RadarGameClient";

export const dynamic = "force-dynamic";

export default async function BrandRadarPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string }>;
  searchParams: Promise<{ mission?: string }>;
}) {
  const { brand: brandSlug } = await params;
  const { mission: initialMissionId } = await searchParams;
  const brand = await findBrandBySlug(brandSlug);

  if (!brand || !brand.active) {
    notFound();
  }

  const publicMissions = await listPublicMissionsForBrand(brand.id);

  return (
    <RadarGameClient
      initialBrand={toPublicBrand(brand)}
      initialMissions={publicMissions}
      initialMissionId={initialMissionId}
    />
  );
}
