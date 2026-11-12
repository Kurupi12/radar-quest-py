import { NextResponse } from "next/server";
import { hasBrandAdminAccess } from "@/lib/auth/adminAuth";
import {
  createMissionRecord,
  deleteMissionRecord,
  findBrandBySlug,
  findMissionById,
  getBrandAdminBundle,
  getDb,
  mapPrismaBrand,
  toPublicBrand,
  updateMissionRecord,
} from "@/lib/db/store";
import { getPrisma, isCloudDbEnabled } from "@/lib/db/prisma";
import { dispatchDropActivatedPush } from "@/lib/push/webPush";
import { isValidLatLng } from "@/lib/radar/geo";
import type { Brand, MissionStatus } from "@/types/radar";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brandSlug = searchParams.get("brandSlug") || "el-vape-club";

  const access = await hasBrandAdminAccess(brandSlug);
  if (!access.authorized) {
    return NextResponse.json(
      { ok: false, message: "Sesión de comercio requerida (brand_session)." },
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

  return NextResponse.json({
    ok: true,
    brand: toPublicBrand(brand),
    missions: bundle.missions,
    reusableNodes: bundle.reusableNodes,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const brandSlug = String(body.brandSlug || "el-vape-club");

    const access = await hasBrandAdminAccess(brandSlug);
    if (!access.authorized) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para crear misiones en esta marca." },
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

    if (brand.missionCredits <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Sin créditos de misiones disponibles. Solicitá recarga a CeroUno Studio.",
        },
        { status: 402 }
      );
    }

    const secretLat = Number(body.secretLat);
    const secretLng = Number(body.secretLng);
    if (!isValidLatLng(secretLat, secretLng)) {
      return NextResponse.json(
        { ok: false, message: "Coordenadas inválidas para fijar el tesoro." },
        { status: 400 }
      );
    }

    const title = String(body.title || "").trim();
    const city = String(body.city || brand.cityDefault || "Asunción").trim();
    const prizeTitle = String(body.prizeTitle || "").trim();

    if (!title || !prizeTitle) {
      return NextResponse.json(
        {
          ok: false,
          message: "Título de la misión y Premio Mayor son obligatorios.",
        },
        { status: 400 }
      );
    }

    const created = await createMissionRecord({
      brand,
      title,
      city,
      zoneHint:
        String(body.zoneHint || "").trim() ||
        `Seguí las ondas térmicas en ${city} para hallar el tesoro.`,
      secretLat,
      secretLng,
      captureRadiusMeters: Math.min(
        65,
        Math.max(20, Number(body.captureRadiusMeters || 35))
      ),
      zoneRadiusMeters: Math.max(500, Number(body.zoneRadiusMeters || 3500)),
      nodeCode: body.nodeCode ? String(body.nodeCode).trim() : null,
      prizeTitle,
      consolationTitle:
        String(body.consolationTitle || "").trim() ||
        "Cupón Explorador Curioso - 15% OFF",
      minPingsForMajorPrize: Math.max(
        1,
        Number(body.minPingsForMajorPrize || 3)
      ),
      validationMode: (body.validationMode === "QR_SCAN" || body.validationMode === "PRESENTIAL_GPS") ? body.validationMode : "HYBRID",
    });

    if (created.mission.status === "ACTIVE") {
      // Disparo asíncrono en segundo plano hacia suscriptores Web Push de la ciudad
      void dispatchDropActivatedPush(brand, created.mission).catch((err) => {
        console.warn("[WebPush] Error en envío de nuevo drop:", err);
      });
    }

    return NextResponse.json({
      ok: true,
      mission: created.mission,
      remainingCredits: created.remainingCredits,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error ? err.message : "Error al crear la misión.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const missionId = String(body.missionId || "");
    const existing = await findMissionById(missionId);

    if (!existing) {
      return NextResponse.json(
        { ok: false, message: "Misión no encontrada." },
        { status: 404 }
      );
    }

    // Verify ownership via brandSlug lookup
    let ownerBrand: Brand | null = null;
    if (isCloudDbEnabled()) {
      const b = await getPrisma().brand.findUnique({
        where: { id: existing.brandId },
      });
      if (b) ownerBrand = mapPrismaBrand(b);
    } else {
      ownerBrand =
        getDb().brands.find((b) => b.id === existing.brandId) || null;
    }

    const ownerSlug = ownerBrand?.slug || "";
    const access = await hasBrandAdminAccess(ownerSlug);
    if (!access.authorized) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para editar esta misión." },
        { status: 401 }
      );
    }

    if (body.secretLat !== undefined && body.secretLng !== undefined) {
      if (!isValidLatLng(Number(body.secretLat), Number(body.secretLng))) {
        return NextResponse.json(
          { ok: false, message: "Coordenadas GPS inválidas." },
          { status: 400 }
        );
      }
    }

    const updated = await updateMissionRecord({
      missionId,
      secretLat:
        body.secretLat !== undefined ? Number(body.secretLat) : undefined,
      secretLng:
        body.secretLng !== undefined ? Number(body.secretLng) : undefined,
      title: body.title ? String(body.title).trim() : undefined,
      city: body.city ? String(body.city).trim() : undefined,
      zoneHint: body.zoneHint ? String(body.zoneHint).trim() : undefined,
      prizeTitle: body.prizeTitle ? String(body.prizeTitle).trim() : undefined,
      consolationTitle: body.consolationTitle
        ? String(body.consolationTitle).trim()
        : undefined,
      minPingsForMajorPrize:
        body.minPingsForMajorPrize !== undefined
          ? Math.max(1, Number(body.minPingsForMajorPrize))
          : undefined,
      validationMode:
        body.validationMode === "QR_SCAN" ||
        body.validationMode === "PRESENTIAL_GPS" ||
        body.validationMode === "HYBRID"
          ? body.validationMode
          : undefined,
      captureRadiusMeters:
        body.captureRadiusMeters !== undefined
          ? Math.min(65, Math.max(20, Number(body.captureRadiusMeters)))
          : undefined,
      zoneRadiusMeters:
        body.zoneRadiusMeters !== undefined
          ? Math.max(500, Number(body.zoneRadiusMeters))
          : undefined,
      status: body.status ? (String(body.status) as MissionStatus) : undefined,
      resetWinner: Boolean(body.resetWinner),
      nodeCode:
        body.nodeCode !== undefined
          ? body.nodeCode
            ? String(body.nodeCode)
            : null
          : undefined,
    });

    const transitionedToActive =
      ownerBrand &&
      updated &&
      updated.status === "ACTIVE" &&
      (existing.status !== "ACTIVE" || Boolean(body.resetWinner));

    if (transitionedToActive && ownerBrand && updated) {
      // Disparo asíncrono en segundo plano hacia suscriptores Web Push de la ciudad
      void dispatchDropActivatedPush(ownerBrand, updated).catch((err) => {
        console.warn("[WebPush] Error en reactivación de drop:", err);
      });
    }

    return NextResponse.json({
      ok: true,
      mission: updated,
      pushTriggered: Boolean(transitionedToActive),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error ? err.message : "Error actualizando misión.",
      },
      { status: 500 }
    );
  }
}

export const PUT = PATCH;

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let missionId = searchParams.get("missionId");

    if (!missionId) {
      try {
        const body = await request.json();
        missionId = body?.missionId;
      } catch {
        // Ignorar si no hay body JSON
      }
    }

    if (!missionId) {
      return NextResponse.json(
        { ok: false, message: "Parámetro missionId requerido." },
        { status: 400 }
      );
    }

    const existing = await findMissionById(missionId);
    if (!existing) {
      return NextResponse.json(
        { ok: false, message: "Misión no encontrada." },
        { status: 404 }
      );
    }

    // Verificar permisos del comercio propietario
    let ownerBrand: Brand | null = null;
    if (isCloudDbEnabled()) {
      const b = await getPrisma().brand.findUnique({
        where: { id: existing.brandId },
      });
      if (b) ownerBrand = mapPrismaBrand(b);
    } else {
      ownerBrand =
        getDb().brands.find((b) => b.id === existing.brandId) || null;
    }

    if (!ownerBrand) {
      return NextResponse.json(
        { ok: false, message: "Marca propietaria no encontrada." },
        { status: 404 }
      );
    }

    const access = await hasBrandAdminAccess(ownerBrand.slug);
    if (!access.authorized) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para eliminar esta misión." },
        { status: 401 }
      );
    }

    const result = await deleteMissionRecord({
      missionId: existing.id,
      brandId: ownerBrand.id,
    });

    if (!result.deleted) {
      return NextResponse.json(
        { ok: false, message: "No se pudo eliminar la misión." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      missionId: existing.id,
      refundedCredit: result.refundedCredit,
      remainingCredits: result.remainingCredits,
      message: result.refundedCredit
        ? `Misión eliminada correctamente. Se reembolsó 1 crédito de drop a tu saldo.`
        : `Misión eliminada correctamente.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error ? err.message : "Error al eliminar la misión.",
      },
      { status: 500 }
    );
  }
}
