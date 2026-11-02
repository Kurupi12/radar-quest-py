import { NextResponse } from "next/server";
import {
  findBrandBySlug,
  listPublicMissionsForBrand,
  toPublicBrand,
} from "@/lib/db/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ brand: string }> }
) {
  const { brand: brandSlug } = await context.params;
  const brand = await findBrandBySlug(brandSlug);

  if (!brand || !brand.active) {
    return NextResponse.json(
      { ok: false, message: "Marca no disponible en Radar Quest." },
      { status: 404 }
    );
  }

  const missions = await listPublicMissionsForBrand(brand.id);

  return NextResponse.json({
    ok: true,
    brand: toPublicBrand(brand),
    missions,
  });
}
