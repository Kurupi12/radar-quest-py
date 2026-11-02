import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { hasSuperAdminAccess } from "@/lib/auth/adminAuth";
import { normalizeWhatsapp } from "@/lib/auth/hmac";
import {
  getDb,
  mapPrismaBrand,
  mapPrismaCreditTx,
  mapPrismaNode,
  persistDb,
} from "@/lib/db/store";
import { getPrisma, isCloudDbEnabled } from "@/lib/db/prisma";

export async function GET(request: Request) {
  if (!(await hasSuperAdminAccess(request))) {
    return NextResponse.json(
      { ok: false, message: "Acceso restringido a Super-Admin (ADMIN_SECRET)." },
      { status: 401 }
    );
  }

  const nowMs = Date.now();

  if (isCloudDbEnabled()) {
    const prisma = getPrisma();
    const [
      brands,
      missions,
      leadsCount,
      reusableNodes,
      creditLedger,
      telemetryRows,
    ] = await Promise.all([
      prisma.brand.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          _count: {
            select: { missions: true, leads: true, reusableNodes: true },
          },
        },
      }),
      prisma.mission.findMany({ select: { status: true } }),
      prisma.brandLead.count(),
      prisma.reusableQrNode.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.creditTransaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.hunterMissionTelemetry.findMany({
        select: { lastPingAt: true, anomalyFlags: true },
      }),
    ]);

    const activeHuntersOnline = telemetryRows.filter(
      (t) => nowMs - t.lastPingAt.getTime() <= 120_000
    ).length;
    const totalAnomaliesBlocked = telemetryRows.reduce(
      (acc, t) => acc + (t.anomalyFlags || 0),
      0
    );

    return NextResponse.json({
      ok: true,
      storageEngine: "PostgreSQL Cloud (Prisma)",
      studio: "CeroUno Studio • Super-Admin Global",
      metrics: {
        totalBrands: brands.length,
        activeBrands: brands.filter((b) => b.active).length,
        totalMissions: missions.length,
        activeMissions: missions.filter((m) => m.status === "ACTIVE").length,
        capturedMissions: missions.filter((m) => m.status === "CAPTURED")
          .length,
        totalLeads: leadsCount,
        activeHuntersOnline,
        totalAnomaliesBlocked,
        totalReusableNodes: reusableNodes.length,
      },
      brands: brands.map((b) => ({
        ...mapPrismaBrand(b),
        missionsCount: b._count.missions,
        leadsCount: b._count.leads,
        nodesCount: b._count.reusableNodes,
      })),
      reusableNodes: reusableNodes.map(mapPrismaNode),
      creditLedger: creditLedger.map(mapPrismaCreditTx),
    });
  }

  const db = getDb();
  const activeHuntersOnline = db.telemetry.filter(
    (t) => nowMs - new Date(t.lastPingAt).getTime() <= 120_000
  ).length;
  const totalAnomaliesBlocked = db.telemetry.reduce(
    (acc, t) => acc + (t.anomalyFlags || 0),
    0
  );

  return NextResponse.json({
    ok: true,
    storageEngine: "Local JSON Store (Configurá DATABASE_URL para Neon/Supabase)",
    studio: "CeroUno Studio • Super-Admin Global",
    metrics: {
      totalBrands: db.brands.length,
      activeBrands: db.brands.filter((b) => b.active).length,
      totalMissions: db.missions.length,
      activeMissions: db.missions.filter((m) => m.status === "ACTIVE").length,
      capturedMissions: db.missions.filter((m) => m.status === "CAPTURED")
        .length,
      totalLeads: db.leads.length,
      activeHuntersOnline,
      totalAnomaliesBlocked,
      totalReusableNodes: db.reusableNodes.length,
    },
    brands: db.brands.map((b) => ({
      ...b,
      missionsCount: db.missions.filter((m) => m.brandId === b.id).length,
      leadsCount: db.leads.filter((l) => l.brandId === b.id).length,
      nodesCount: db.reusableNodes.filter((n) => n.brandId === b.id).length,
    })),
    reusableNodes: db.reusableNodes,
    creditLedger: db.creditLedger.slice(0, 25),
  });
}

export async function POST(request: Request) {
  if (!(await hasSuperAdminAccess(request))) {
    return NextResponse.json(
      { ok: false, message: "Acceso restringido a Super-Admin (ADMIN_SECRET)." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "CREATE_BRAND") {
      const name = String(body.name || "").trim();
      const rawSlug = String(body.slug || name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const whatsapp =
        normalizeWhatsapp(String(body.whatsapp || "")) || "+595981000000";
      const adminPin = String(body.adminPin || "123456").trim();

      if (!name || !rawSlug) {
        return NextResponse.json(
          { ok: false, message: "Nombre y slug de marca son obligatorios." },
          { status: 400 }
        );
      }
      if (!/^\d{6}$/.test(adminPin)) {
        return NextResponse.json(
          { ok: false, message: "El PIN del comercio debe tener 6 dígitos numéricos." },
          { status: 400 }
        );
      }

      const initialCredits = Math.max(0, Number(body.missionCredits ?? 5));

      if (isCloudDbEnabled()) {
        const prisma = getPrisma();
        const exists = await prisma.brand.findUnique({
          where: { slug: rawSlug },
        });
        if (exists) {
          return NextResponse.json(
            { ok: false, message: `El slug "${rawSlug}" ya está en uso.` },
            { status: 400 }
          );
        }

        const created = await prisma.brand.create({
          data: {
            slug: rawSlug,
            name,
            tagline:
              String(body.tagline || "").trim() ||
              `Caza del Tesoro QR Oficial de ${name}`,
            logoEmoji: String(body.logoEmoji || "radar").trim(),
            primaryColor: String(body.primaryColor || "#a855f7"),
            secondaryColor: String(body.secondaryColor || "#00f0ff"),
            whatsapp,
            requireAdult18: Boolean(body.requireAdult18),
            missionCredits: initialCredits,
            cityDefault: String(body.cityDefault || "Asunción"),
            adminPin,
            active: true,
          },
        });

        if (initialCredits > 0) {
          await prisma.creditTransaction.create({
            data: {
              brandId: created.id,
              delta: initialCredits,
              reason: "Alta de nueva marca cliente en CeroUno Studio",
              performedBy: "CeroUno Studio Super-Admin",
            },
          });
        }

        return NextResponse.json({ ok: true, brand: mapPrismaBrand(created) });
      }

      const db = getDb();
      if (db.brands.some((b) => b.slug === rawSlug)) {
        return NextResponse.json(
          { ok: false, message: `El slug "${rawSlug}" ya está en uso.` },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const newBrand = {
        id: `brand_${crypto.randomUUID().slice(0, 8)}`,
        slug: rawSlug,
        name,
        tagline:
          String(body.tagline || "").trim() ||
          `Caza del Tesoro QR Oficial de ${name}`,
        logoEmoji: String(body.logoEmoji || "radar").trim(),
        primaryColor: String(body.primaryColor || "#a855f7"),
        secondaryColor: String(body.secondaryColor || "#00f0ff"),
        whatsapp,
        requireAdult18: Boolean(body.requireAdult18),
        missionCredits: initialCredits,
        cityDefault: String(body.cityDefault || "Asunción"),
        adminPin,
        active: true,
        createdAt: now,
        updatedAt: now,
      };

      db.brands.push(newBrand);
      if (initialCredits > 0) {
        db.creditLedger.unshift({
          id: `crd_${crypto.randomUUID().slice(0, 8)}`,
          brandId: newBrand.id,
          delta: initialCredits,
          reason: "Alta de nueva marca cliente en CeroUno Studio",
          performedBy: "CeroUno Studio Super-Admin",
          createdAt: now,
        });
      }
      persistDb(db);
      return NextResponse.json({ ok: true, brand: newBrand });
    }

    if (action === "UPDATE_PIN") {
      const brandId = String(body.brandId || "");
      const newPin = String(body.adminPin || "").trim();
      if (!/^\d{6}$/.test(newPin)) {
        return NextResponse.json(
          { ok: false, message: "El PIN debe tener exactamente 6 dígitos." },
          { status: 400 }
        );
      }

      if (isCloudDbEnabled()) {
        const updated = await getPrisma().brand.update({
          where: { id: brandId },
          data: { adminPin: newPin },
        });
        return NextResponse.json({ ok: true, brand: mapPrismaBrand(updated) });
      }

      const db = getDb();
      const brand = db.brands.find((b) => b.id === brandId);
      if (!brand) {
        return NextResponse.json(
          { ok: false, message: "Marca no encontrada." },
          { status: 404 }
        );
      }
      brand.adminPin = newPin;
      brand.updatedAt = new Date().toISOString();
      persistDb(db);
      return NextResponse.json({ ok: true, brand });
    }

    if (action === "RECHARGE_CREDITS") {
      const brandId = String(body.brandId || "");
      const delta = Number(body.delta || 0);
      const reason =
        String(body.reason || "").trim() || "Recarga comercial de créditos";

      if (!brandId || !Number.isFinite(delta) || delta === 0) {
        return NextResponse.json(
          { ok: false, message: "Marca o cantidad de créditos inválida." },
          { status: 400 }
        );
      }

      if (isCloudDbEnabled()) {
        const prisma = getPrisma();
        const current = await prisma.brand.findUnique({ where: { id: brandId } });
        if (!current) {
          return NextResponse.json(
            { ok: false, message: "Marca no encontrada." },
            { status: 404 }
          );
        }
        const nextCredits = Math.max(0, current.missionCredits + delta);
        const [updated] = await prisma.$transaction([
          prisma.brand.update({
            where: { id: brandId },
            data: { missionCredits: nextCredits },
          }),
          prisma.creditTransaction.create({
            data: {
              brandId,
              delta,
              reason,
              performedBy: "CeroUno Studio Super-Admin",
            },
          }),
        ]);
        return NextResponse.json({ ok: true, brand: mapPrismaBrand(updated) });
      }

      const db = getDb();
      const brand = db.brands.find((b) => b.id === brandId);
      if (!brand) {
        return NextResponse.json(
          { ok: false, message: "Marca no encontrada." },
          { status: 404 }
        );
      }

      const now = new Date().toISOString();
      brand.missionCredits = Math.max(0, brand.missionCredits + delta);
      brand.updatedAt = now;
      db.creditLedger.unshift({
        id: `crd_${crypto.randomUUID().slice(0, 8)}`,
        brandId: brand.id,
        delta,
        reason,
        performedBy: "CeroUno Studio Super-Admin",
        createdAt: now,
      });
      persistDb(db);
      return NextResponse.json({ ok: true, brand });
    }

    if (action === "CREATE_NODE") {
      const brandId = String(body.brandId || "");
      const rawCode =
        String(body.code || "").trim().toUpperCase() ||
        `RQ-NODE-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

      if (isCloudDbEnabled()) {
        const prisma = getPrisma();
        const brand = await prisma.brand.findUnique({ where: { id: brandId } });
        if (!brand) {
          return NextResponse.json(
            { ok: false, message: "Marca no encontrada." },
            { status: 404 }
          );
        }
        const exists = await prisma.reusableQrNode.findUnique({
          where: { code: rawCode },
        });
        if (exists) {
          return NextResponse.json(
            { ok: false, message: "Ese código de Nodo QR ya existe." },
            { status: 400 }
          );
        }
        const created = await prisma.reusableQrNode.create({
          data: {
            code: rawCode,
            label:
              String(body.label || "").trim() ||
              `Nodo Físico Reutilizable (${brand.name})`,
            brandId: brand.id,
            active: true,
          },
        });
        return NextResponse.json({ ok: true, node: mapPrismaNode(created) });
      }

      const db = getDb();
      const brand = db.brands.find((b) => b.id === brandId);
      if (!brand) {
        return NextResponse.json(
          { ok: false, message: "Marca no encontrada." },
          { status: 404 }
        );
      }
      if (db.reusableNodes.some((n) => n.code === rawCode)) {
        return NextResponse.json(
          { ok: false, message: "Ese código de Nodo QR ya existe." },
          { status: 400 }
        );
      }
      const node = {
        id: `node_${crypto.randomUUID().slice(0, 8)}`,
        code: rawCode,
        label:
          String(body.label || "").trim() ||
          `Nodo Físico Reutilizable (${brand.name})`,
        brandId: brand.id,
        assignedMissionId: null,
        active: true,
        createdAt: new Date().toISOString(),
      };
      db.reusableNodes.push(node);
      persistDb(db);
      return NextResponse.json({ ok: true, node });
    }

    if (action === "TOGGLE_BRAND") {
      const brandId = String(body.brandId || "");
      if (isCloudDbEnabled()) {
        const prisma = getPrisma();
        const b = await prisma.brand.findUnique({ where: { id: brandId } });
        if (!b) {
          return NextResponse.json(
            { ok: false, message: "Marca no encontrada." },
            { status: 404 }
          );
        }
        const updated = await prisma.brand.update({
          where: { id: brandId },
          data: { active: !b.active },
        });
        return NextResponse.json({ ok: true, brand: mapPrismaBrand(updated) });
      }

      const db = getDb();
      const brand = db.brands.find((b) => b.id === brandId);
      if (!brand) {
        return NextResponse.json(
          { ok: false, message: "Marca no encontrada." },
          { status: 404 }
        );
      }
      brand.active = !brand.active;
      brand.updatedAt = new Date().toISOString();
      persistDb(db);
      return NextResponse.json({ ok: true, brand });
    }

    return NextResponse.json(
      { ok: false, message: "Acción de Super-Admin desconocida." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error ? err.message : "Error en panel Super-Admin.",
      },
      { status: 500 }
    );
  }
}
