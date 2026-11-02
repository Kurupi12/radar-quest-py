import { notFound } from "next/navigation";
import { hasBrandAdminAccess } from "@/lib/auth/adminAuth";
import {
  findBrandBySlug,
  getBrandAdminBundle,
  getBrandHeatmapAndAnalytics,
  toPublicBrand,
} from "@/lib/db/store";
import { BrandPinGate } from "@/components/admin/BrandPinGate";
import { BrandAdminClient } from "@/components/admin/BrandAdminClient";

export const dynamic = "force-dynamic";

export default async function BrandMerchantAdminPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand: brandSlug } = await params;
  const brand = await findBrandBySlug(brandSlug);

  if (!brand) {
    notFound();
  }

  const publicBrand = toPublicBrand(brand);
  const access = await hasBrandAdminAccess(brand.slug);

  if (!access.authorized) {
    return <BrandPinGate brand={publicBrand} />;
  }

  const [bundle, bi] = await Promise.all([
    getBrandAdminBundle(brand.id),
    getBrandHeatmapAndAnalytics(brand.id),
  ]);

  return (
    <BrandAdminClient
      initialBrand={publicBrand}
      initialMissions={bundle.missions}
      initialNodes={bundle.reusableNodes}
      initialAnalytics={bi.analytics}
      initialHeatmapPoints={bi.heatmapPoints}
    />
  );
}
