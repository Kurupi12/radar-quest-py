import { NextResponse } from "next/server";
import {
  deactivatePushSubscription,
  findBrandBySlug,
  upsertPushSubscription,
} from "@/lib/db/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const brandSlug = String(body.brandSlug || "").trim();
    const city = String(body.city || "").trim();
    const hunterId = body.hunterId ? String(body.hunterId).trim() : null;
    const subscription = body.subscription as
      | {
          endpoint?: string;
          keys?: { p256dh?: string; auth?: string };
        }
      | undefined;

    if (
      !brandSlug ||
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Suscripción Web Push incompleta (endpoint, keys.p256dh, keys.auth y brandSlug requeridos).",
        },
        { status: 400 }
      );
    }

    const brand = await findBrandBySlug(brandSlug);
    if (!brand) {
      return NextResponse.json(
        { ok: false, message: "Marca no encontrada." },
        { status: 404 }
      );
    }

    const saved = await upsertPushSubscription({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      brandId: brand.id,
      city: city || brand.cityDefault,
      hunterId,
    });

    return NextResponse.json({
      ok: true,
      subscriptionId: saved.id,
      city: saved.city,
      brandSlug: brand.slug,
      message: `Alertas de Drops activadas para ${saved.city}.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Error registrando suscripción Web Push.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const endpoint = String(body.endpoint || "").trim();
    if (!endpoint) {
      return NextResponse.json(
        { ok: false, message: "Endpoint requerido." },
        { status: 400 }
      );
    }

    await deactivatePushSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, message: "No se pudo cancelar la suscripción." },
      { status: 500 }
    );
  }
}

