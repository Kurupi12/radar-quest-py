import { NextResponse } from "next/server";
import { hasBrandAdminAccess } from "@/lib/auth/adminAuth";
import { findBrandBySlug, getBrandAdminBundle } from "@/lib/db/store";
import { sanitizePublicAlias } from "@/lib/radar/aliasPrivacy";

function escapeCsvCell(
  val: string | number | boolean | null | undefined
): string {
  const str = val === null || val === undefined ? "" : String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brandSlug = searchParams.get("brandSlug") || "el-vape-club";

  const access = await hasBrandAdminAccess(brandSlug);
  if (!access.authorized) {
    return NextResponse.json(
      { ok: false, message: "No autorizado para exportar leads de esta marca." },
      { status: 401 }
    );
  }

  const brand = await findBrandBySlug(brandSlug);
  if (!brand) {
    return NextResponse.json(
      { ok: false, message: "Marca no encontrada." },
      { status: 404 }
    );
  }

  const bundle = await getBrandAdminBundle(brand.id);
  const leads = bundle.leads;

  const headers = [
    "ID_Lead",
    "Marca",
    "Alias_Instagram",
    "WhatsApp_E164",
    "WaMe_Link",
    "Mayor_18",
    "Ciudad",
    "Mision_Origen",
    "Fecha_Registro_ISO",
  ];

  const rows = leads.map((lead) => {
    const cleanDigits = lead.whatsapp.replace(/[^\d]/g, "");
    const mission = bundle.missions.find(
      (m) => m.id === lead.sourceMissionId
    );
    return [
      lead.id,
      brand.name,
      sanitizePublicAlias(lead.alias),
      lead.whatsapp,
      `https://wa.me/${cleanDigits}`,
      lead.isAdult18 ? "SI" : "NO",
      lead.city || brand.cityDefault,
      mission?.title || "Registro Directo",
      lead.createdAt,
    ]
      .map(escapeCsvCell)
      .join(",");
  });

  const csvContent = `\uFEFF${headers.join(",")}\r\n${rows.join("\r\n")}`;
  const filename = `leads-whatsapp-${brand.slug}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
