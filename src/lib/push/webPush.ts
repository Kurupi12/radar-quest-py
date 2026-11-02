import webpush from "web-push";
import {
  deactivatePushSubscription,
  listActivePushSubscriptionsForCity,
} from "@/lib/db/store";
import type { Brand, Mission } from "@/types/radar";

const DEV_VAPID_PUBLIC =
  "BJi-KEcBTFi9PnfjgFWzP1u0vIELkkx1Oz9sUoYdHeIK7Vqv99YiU9PSaDhTniRvCrPzM1BsxKtNWdGO9WkDyrU";
const DEV_VAPID_PRIVATE = "BsgXG4W1QscgVn4QYtbyqkvpqVJvnyDqJqv2M7QABRE";

export interface PushDispatchEventLog {
  missionId: string;
  missionTitle: string;
  brandSlug: string;
  city: string;
  title: string;
  targetedCount: number;
  sentCount: number;
  failedCount: number;
  dispatchedAt: string;
}

const globalForPush = globalThis as unknown as {
  __vapidConfigured?: boolean;
  __pushDispatchLogs?: PushDispatchEventLog[];
};

export function getVapidPublicKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || DEV_VAPID_PUBLIC;
}

function ensureWebPushConfigured(): void {
  if (globalForPush.__vapidConfigured) return;

  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:alertas@radarquest.com.py";
  const publicKey = getVapidPublicKey();
  const privateKey =
    process.env.VAPID_PRIVATE_KEY?.trim() || DEV_VAPID_PRIVATE;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  globalForPush.__vapidConfigured = true;
}

export function getRecentPushDispatchLogs(): PushDispatchEventLog[] {
  return globalForPush.__pushDispatchLogs || [];
}

/**
 * Dispara en segundo plano notificaciones Web Push a todos los cazadores
 * suscriptos a la marca y ciudad cuando un Drop pasa a estado 'ACTIVE'.
 */
export async function dispatchDropActivatedPush(
  brand: Brand,
  mission: Mission
): Promise<PushDispatchEventLog> {
  ensureWebPushConfigured();

  const subscriptions = await listActivePushSubscriptionsForCity(
    brand.id,
    mission.city
  );

  const notificationTitle =
    "🚨 ¡NUEVO DROP ACTIVADO! Hay un tesoro cerca de ti";
  const payload = JSON.stringify({
    title: notificationTitle,
    body: `${brand.name} activó "${mission.title}" en ${mission.city}. Pista: ${mission.zoneHint}`,
    icon: "/icon-192.svg",
    badge: "/icon-192.svg",
    tag: `drop-${mission.id}`,
    city: mission.city,
    brandSlug: brand.slug,
    missionId: mission.id,
    url: `/b/${brand.slug}?mission=${encodeURIComponent(mission.id)}`,
  });

  const eventLog: PushDispatchEventLog = {
    missionId: mission.id,
    missionTitle: mission.title,
    brandSlug: brand.slug,
    city: mission.city,
    title: notificationTitle,
    targetedCount: subscriptions.length,
    sentCount: 0,
    failedCount: 0,
    dispatchedAt: new Date().toISOString(),
  };

  if (!globalForPush.__pushDispatchLogs) {
    globalForPush.__pushDispatchLogs = [];
  }
  globalForPush.__pushDispatchLogs.unshift(eventLog);
  if (globalForPush.__pushDispatchLogs.length > 30) {
    globalForPush.__pushDispatchLogs.length = 30;
  }

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
          { TTL: 3600, urgency: "high", timeout: 5000 }
        );
        eventLog.sentCount += 1;
      } catch (err) {
        eventLog.failedCount += 1;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await deactivatePushSubscription(sub.endpoint).catch(() => {});
        }
      }
    })
  );

  return eventLog;
}
