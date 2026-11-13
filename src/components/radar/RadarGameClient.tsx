"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BellRing,
  Camera,
  Car,
  Compass,
  Flame,
  Gamepad2,
  Gift,
  Lock,
  MapPin,
  Navigation,
  Radio,
  ShieldAlert,
  Snowflake,
  Sun,
  Thermometer,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
  QrCode,
  Sparkles,
} from "lucide-react";
import type {
  Hunter,
  PublicBrand,
  PublicMission,
  RadarClaimResponse,
  RadarPingResponse,
  TacticalCooldownSnapshot,
  TacticalHint,
  TacticalTrend,
  ThermalState,
} from "@/types/radar";
import { ArcadeMap } from "@/components/radar/ArcadeMap";
import { RadarCanvasOverlay } from "@/components/radar/RadarCanvasOverlay";
import { OnboardingModal } from "@/components/radar/OnboardingModal";
import { QrClaimModal } from "@/components/radar/QrClaimModal";
import { ArcadeQrScannerModal } from "@/components/radar/ArcadeQrScannerModal";
import { ViralRecorder } from "@/components/radar/ViralRecorder";
import { RadarPreloader } from "@/components/radar/RadarPreloader";
import { BrandIconSvg } from "@/components/icons/BrandIconSvg";
import { arcadeHardware } from "@/lib/hardware/arcadeHardware";
import { VEHICLE_OVERRIDE_MESSAGE } from "@/lib/radar/tacticalVectorAssistance";

interface RadarGameClientProps {
  initialBrand: PublicBrand;
  initialMissions: PublicMission[];
  initialMissionId?: string;
  autoOpenClaimToken?: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getThermalBadgeStyle(
  state: ThermalState,
  validationMode?: string
): {
  bg: string;
  border: string;
  text: string;
  title: string;
  subtitle: string;
} {
  switch (state) {
    case "QUEMANDO":
      let quemandoSub = "(<30M) • ¡RECLAMÁ TU PREMIO!";
      if (validationMode === "PRESENTIAL_GPS") {
        quemandoSub = "(<30M) • ¡ENCONTRÁ AL EQUIPO!";
      } else if (validationMode === "QR_SCAN") {
        quemandoSub = "(<30M) • ¡ESCANEÁ EL QR!";
      }
      return {
        bg: "rgba(220, 38, 38, 0.95)",
        border: "#fde047",
        text: "#fef08a",
        title: "¡QUEMANDO!",
        subtitle: quemandoSub,
      };
    case "CALIENTE":
      return {
        bg: "rgba(234, 88, 12, 0.92)",
        border: "#fb923c",
        text: "#ffedd5",
        title: "CALIENTE",
        subtitle: "MUY CERCA DEL PUNTO",
      };
    case "TIBIO":
      return {
        bg: "rgba(161, 98, 7, 0.9)",
        border: "#facc15",
        text: "#fef9c3",
        title: "TIBIO",
        subtitle: "EN ZONA DE RASTREO",
      };
    case "CONGELADO":
      return {
        bg: "rgba(3, 105, 161, 0.9)",
        border: "#38bdf8",
        text: "#e0f2fe",
        title: "CONGELADO",
        subtitle: "LEJOS DEL PUNTO",
      };
    case "TELEPORT_ANOMALY":
      return {
        bg: "rgba(127, 29, 29, 0.95)",
        border: "#ef4444",
        text: "#fecaca",
        title: "TELEPORT ANOMALY",
        subtitle: "ANTI-SPOOFING ACTIVO",
      };
    case "FUERA DE ZONA":
    default:
      return {
        bg: "rgba(30, 17, 58, 0.92)",
        border: "#a855f7",
        text: "#e9d5ff",
        title: "FUERA DE ZONA",
        subtitle: "ACERCATE A LA CIUDAD",
      };
  }
}

function ThermalStatusIcon({ state }: { state: ThermalState }) {
  switch (state) {
    case "QUEMANDO":
      return <Flame className="w-3.5 h-3.5 shrink-0" />;
    case "CALIENTE":
      return <Thermometer className="w-3.5 h-3.5 shrink-0" />;
    case "TIBIO":
      return <Zap className="w-3.5 h-3.5 shrink-0" />;
    case "CONGELADO":
      return <Snowflake className="w-3.5 h-3.5 shrink-0" />;
    case "TELEPORT_ANOMALY":
      return <ShieldAlert className="w-3.5 h-3.5 shrink-0" />;
    case "FUERA DE ZONA":
    default:
      return <Radio className="w-3.5 h-3.5 shrink-0" />;
  }
}

interface TacticalVectorReadoutProps {
  tacticalHint?: TacticalHint | null;
  inVehicleMode: boolean;
  speedKmh: number;
}

const TacticalVectorReadout = memo(function TacticalVectorReadout({
  tacticalHint,
  inVehicleMode,
  speedKmh,
}: TacticalVectorReadoutProps) {
  const isVehicle = inVehicleMode || speedKmh >= 20;
  const targetMessage = isVehicle
    ? VEHICLE_OVERRIDE_MESSAGE
    : tacticalHint?.message ||
      "CALIBRANDO VECTOR: CAMINA A PIE PARA FIJAR RUMBO";
  const effectiveTrend: TacticalTrend = isVehicle
    ? "NEUTRAL"
    : tacticalHint?.trend || "NEUTRAL";
  const deltaMeters = tacticalHint?.deltaMeters ?? 0;

  const [typedText, setTypedText] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);

  useEffect(() => {
    let charIdx = 0;
    setTypedText("");
    setIsTyping(true);

    const timer = window.setInterval(() => {
      charIdx += 1;
      if (charIdx >= targetMessage.length) {
        setTypedText(targetMessage);
        setIsTyping(false);
        window.clearInterval(timer);
      } else {
        setTypedText(targetMessage.slice(0, charIdx));
      }
    }, 22);

    return () => {
      window.clearInterval(timer);
    };
  }, [targetMessage]);

  const variantClass = isVehicle
    ? "rf-tactical-neutral"
    : effectiveTrend === "CLOSING_IN"
    ? "rf-tactical-closing"
    : effectiveTrend === "DRIFTING_AWAY"
    ? "rf-tactical-drifting"
    : "rf-tactical-neutral";

  const showDelta = !isVehicle && Math.abs(deltaMeters) >= 1;
  const formattedDelta = `${deltaMeters > 0 ? "+" : ""}${Math.round(
    deltaMeters
  )}M`;

  return (
    <div
      className={`rf-tactical-slot ${variantClass} px-2.5 py-1.5 flex items-center justify-between gap-2`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {isVehicle ? (
          <Car className="w-3.5 h-3.5 shrink-0" />
        ) : effectiveTrend === "CLOSING_IN" ? (
          <Navigation className="w-3.5 h-3.5 shrink-0" />
        ) : effectiveTrend === "DRIFTING_AWAY" ? (
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Compass className="w-3.5 h-3.5 shrink-0" />
        )}
        <p className="font-retro text-[14px] leading-tight tracking-wider uppercase break-words">
          <span>{typedText}</span>
          <span
            className={`inline-block w-1.5 h-3 ml-0.5 align-middle bg-current ${
              isTyping ? "opacity-100" : "animate-pulse"
            }`}
          />
        </p>
      </div>
      {showDelta && (
        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/50 border border-current/40 shrink-0">
          {formattedDelta}
        </span>
      )}
    </div>
  );
});

export function RadarGameClient({
  initialBrand,
  initialMissions,
  initialMissionId,
  autoOpenClaimToken,
}: RadarGameClientProps) {
  const [brand] = useState<PublicBrand>(initialBrand);
  const [missions, setMissions] = useState<PublicMission[]>(initialMissions);
  const [selectedMissionId, setSelectedMissionId] = useState<string>(() => {
    if (
      initialMissionId &&
      initialMissions.some((m) => m.id === initialMissionId)
    ) {
      return initialMissionId;
    }
    return (
      initialMissions.find((m) => m.status === "ACTIVE")?.id ||
      initialMissions[0]?.id ||
      ""
    );
  });

  const selectedMission =
    missions.find((m) => m.id === selectedMissionId) || missions[0] || null;

  const [hunter, setHunter] = useState<Hunter | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [checkingSession, setCheckingSession] = useState(true);

  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  }>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("rq_last_known_coords");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") {
            return {
              lat: parsed.lat,
              lng: parsed.lng,
              accuracy: parsed.accuracy || 15,
            };
          }
        }
      } catch {}
    }
    return {
      lat: selectedMission?.publicCenterLat ?? -27.3306,
      lng: selectedMission?.publicCenterLng ?? -55.8667,
      accuracy: 12,
    };
  });

  const [gpsMode, setGpsMode] = useState<"real" | "simulator">("real");
  const [showSimBar, setShowSimBar] = useState(false);
  const [demoQrHint, setDemoQrHint] = useState<string>(
    autoOpenClaimToken || ""
  );

  const [pingData, setPingData] = useState<RadarPingResponse | null>(null);
  const currentThermal: ThermalState =
    pingData?.thermalState || "FUERA DE ZONA";
  const [muted, setMuted] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [preloaderDismissed, setPreloaderDismissed] = useState(false);

  // Web Push Drop Alerts State
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushBannerMsg, setPushBannerMsg] = useState<string | null>(null);

  // External camera URL deep-link modal (/b/[brand]/claim?token=...)
  const [showExternalClaimModal, setShowExternalClaimModal] = useState(
    Boolean(autoOpenClaimToken)
  );
  // Phase 2 In-App Retro-Arcade Camera Scanner (enabled ONLY in QUEMANDO & <20 km/h)
  const [showInAppScanner, setShowInAppScanner] = useState(false);
  // Floating Climax Victory Banner state (<30m)
  const [victoryBannerDismissed, setVictoryBannerDismissed] = useState(false);

  // Re-open victory banner when entering QUEMANDO
  useEffect(() => {
    if (currentThermal === "QUEMANDO") {
      setVictoryBannerDismissed(false);
    }
  }, [currentThermal]);

  // Presential GPS Victory Mode state (Marketing team waiting on-site)
  const [showPresentialModal, setShowPresentialModal] = useState(false);
  const [presentialClaiming, setPresentialClaiming] = useState(false);
  const [presentialClaimResult, setPresentialClaimResult] =
    useState<RadarClaimResponse | null>(null);

  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tacticalSnapshotRef = useRef<TacticalCooldownSnapshot | null>(null);
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  const handleOverlayCanvasReady = useCallback((c: HTMLCanvasElement) => {
    overlayCanvasRef.current = c;
  }, []);

  // 1. Restore session from localStorage & verify HMAC cookie
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        const cached = localStorage.getItem("rq_hunter_profile");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.hunter?.id) {
            if (!brand.requireAdult18 || parsed.hunter.isAdult18) {
              setHunter(parsed.hunter);
              setSessionToken(parsed.sessionToken || "");
            }
          }
        }

        const res = await fetch("/api/auth/onboard");
        const data = await res.json();
        if (!cancelled && data?.authenticated && data?.hunter) {
          if (!brand.requireAdult18 || data.hunter.isAdult18) {
            setHunter(data.hunter);
          }
        }
      } catch {
        // Ignore offline check
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, [brand.requireAdult18]);

  // Check existing Web Push subscription state
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }

    navigator.serviceWorker
      .getRegistration("/service-worker.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setPushSubscribed(true);
      })
      .catch(() => {});
  }, []);

  // Subscribe to Web Push Drops for current Brand & City
  const handleSubscribeDropsPush = async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setPushBannerMsg("Web Push no soportado en este navegador.");
      return;
    }

    setPushLoading(true);
    setPushBannerMsg(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushBannerMsg(
          "Habilitá el permiso de notificaciones para recibir alertas de Drops."
        );
        setPushLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.register(
        "/service-worker.js"
      );
      await navigator.serviceWorker.ready;

      const vapidRes = await fetch("/api/push/vapid");
      const vapidJson = await vapidRes.json();
      if (!vapidJson?.publicKey) {
        throw new Error("Clave VAPID no disponible.");
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidJson.publicKey),
        });
      }

      const targetCity = selectedMission?.city || brand.cityDefault;
      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandSlug: brand.slug,
          city: targetCity,
          hunterId: hunter?.id || null,
          subscription: subscription.toJSON(),
        }),
      });
      const saveJson = await saveRes.json();
      if (saveJson.ok) {
        setPushSubscribed(true);
        setPushBannerMsg(`Alertas activadas para nuevos Drops en ${targetCity}.`);
        arcadeHardware.playPowerUpOnboarding();
        window.setTimeout(() => setPushBannerMsg(null), 3500);
      }
    } catch {
      setPushBannerMsg("No se pudo activar Web Push en este dispositivo.");
    } finally {
      setPushLoading(false);
    }
  };

  // 2. Request & keep Screen Wake Lock active
  useEffect(() => {
    if (!hunter) return;
    arcadeHardware.requestWakeLock().then(setWakeLockActive);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        arcadeHardware.requestWakeLock().then(setWakeLockActive);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hunter]);

  // 3. Re-center map on mission switch
  useEffect(() => {
    if (selectedMission) {
      setPingData(null);
      tacticalSnapshotRef.current = null;
      if (gpsMode === "simulator") {
        setCoords({
          lat: selectedMission.publicCenterLat,
          lng: selectedMission.publicCenterLng,
          accuracy: 10,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMissionId]);

  // 4. Send Telemetry Ping to Server
  const sendRadarPing = useCallback(
    async (targetCoords: { lat: number; lng: number; accuracy: number }) => {
      if (!hunter || !selectedMission) return;

      try {
        const res = await fetch("/api/radar/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            missionId: selectedMission.id,
            brandSlug: brand.slug,
            lat: targetCoords.lat,
            lng: targetCoords.lng,
            accuracy: targetCoords.accuracy,
            hunterId: hunter.id,
            alias: hunter.alias,
            sessionToken,
            prevTacticalState: tacticalSnapshotRef.current,
          }),
        });

        const data = (await res.json()) as RadarPingResponse;
        if (data.ok) {
          if (data.tacticalStateSnapshot) {
            tacticalSnapshotRef.current = data.tacticalStateSnapshot;
          }
          setPingData(data);
          if (data.dangerAlert?.active) {
            arcadeHardware.playRivalDangerSiren();
          } else {
            arcadeHardware.triggerThermalFeedback(data.thermalState);
          }

          if (data.missionStatus === "CAPTURED") {
            setMissions((prev) =>
              prev.map((m) =>
                m.id === selectedMission.id
                  ? {
                      ...m,
                      status: "CAPTURED",
                      winnerAlias: data.winnerAlias,
                    }
                  : m
              )
            );
          }
        }
      } catch {
        // Silent retry on next cycle
      }
    },
    [hunter, selectedMission, brand.slug, sessionToken]
  );

  // 5. Real High-Accuracy Geolocation Watcher + 4s Heartbeat Ping
  useEffect(() => {
    if (!hunter || !selectedMission || gpsMode !== "real") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy || 12),
        };
        try {
          localStorage.setItem(
            "rq_last_known_coords",
            JSON.stringify({
              lat: next.lat,
              lng: next.lng,
              accuracy: next.accuracy,
              savedAt: Date.now(),
            })
          );
        } catch {}
        setCoords(next);
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 2500,
        timeout: 8000,
      }
    );

    sendRadarPing(coordsRef.current);
    const interval = window.setInterval(() => {
      sendRadarPing(coordsRef.current);
    }, 4000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(interval);
    };
  }, [hunter, selectedMission, gpsMode, sendRadarPing]);

  const triggerDemoStep = async (
    preset:
      | "CONGELADO"
      | "TIBIO"
      | "CALIENTE"
      | "QUEMANDO"
      | "VEHICLE"
      | "TELEPORT"
  ) => {
    if (!selectedMission) return;
    setGpsMode("simulator");

    try {
      const res = await fetch("/api/radar/demo-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionId: selectedMission.id,
          preset,
        }),
      });
      const step = await res.json();
      if (step.ok) {
        const nextCoords = {
          lat: step.lat,
          lng: step.lng,
          accuracy: step.accuracy,
        };
        setCoords(nextCoords);
        if (step.demoQrCode) setDemoQrHint(step.demoQrCode);
        await sendRadarPing(nextCoords);
      }
    } catch {}
  };

  const toggleAudio = () => {
    const next = !muted;
    setMuted(next);
    arcadeHardware.setMuted(next);
    if (!next) {
      arcadeHardware.playBgm();
    }
  };

  // Reproducir BGM en la primera interacción táctil si el audio está activo
  useEffect(() => {
    if (typeof window === "undefined") return;
    const startAudioOnInteraction = () => {
      if (!arcadeHardware.isMuted()) {
        arcadeHardware.playBgm();
      }
    };
    window.addEventListener("pointerdown", startAudioOnInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", startAudioOnInteraction);
    };
  }, []);

  // Conmutar BGM adaptativa según estado térmico (Exploración vs. Tensión en TIBIO / CALIENTE)
  useEffect(() => {
    arcadeHardware.syncBgmWithThermalState(currentThermal);
  }, [currentThermal]);
  const missionValidationMode =
    selectedMission?.validationMode || pingData?.validationMode || "HYBRID";
  const thermalStyle = getThermalBadgeStyle(
    currentThermal,
    missionValidationMode
  );

  // Enable QR Scanner when thermalState === 'QUEMANDO' (<30m) with mobile GPS jitter tolerance
  const canOpenScanner = Boolean(
    missionValidationMode !== "PRESENTIAL_GPS" &&
      (pingData?.canOpenQrScanner ??
        (currentThermal === "QUEMANDO" &&
          (!pingData?.inVehicleMode || (pingData?.speedKmh ?? 0) < 35)))
  );

  // Presential Mode: Enable GPS Claim button when in QUEMANDO (<30m) with mobile GPS jitter tolerance
  const canClaimPresential = Boolean(
    missionValidationMode !== "QR_SCAN" &&
      (pingData?.canClaimPresential ??
        (currentThermal === "QUEMANDO" &&
          (!pingData?.inVehicleMode || (pingData?.speedKmh ?? 0) < 35) &&
          selectedMission?.status === "ACTIVE"))
  );

  const handlePresentialClaim = async () => {
    if (!hunter || !selectedMission || presentialClaiming) return;
    setPresentialClaiming(true);

    try {
      let activeCoords = coords;
      if (
        gpsMode === "real" &&
        typeof navigator !== "undefined" &&
        navigator.geolocation
      ) {
        activeCoords = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({
                lat: Number(pos.coords.latitude.toFixed(6)),
                lng: Number(pos.coords.longitude.toFixed(6)),
                accuracy: Math.round(pos.coords.accuracy || 10),
              }),
            () => resolve(coords),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }

      const res = await fetch("/api/radar/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimMethod: "PRESENTIAL_GPS",
          tokenOrNodeCode: "PRESENTIAL_GPS",
          missionId: selectedMission.id,
          brandSlug: brand.slug,
          lat: activeCoords.lat,
          lng: activeCoords.lng,
          accuracy: activeCoords.accuracy,
          hunterId: hunter.id,
          alias: hunter.alias,
          sessionToken,
        }),
      });

      const data = (await res.json()) as RadarClaimResponse;
      if (data.ok) {
        arcadeHardware.playVictoryFanfare();
        setMissions((prev) =>
          prev.map((m) =>
            m.id === selectedMission.id
              ? {
                  ...m,
                  status: "CAPTURED",
                  winnerAlias: hunter.alias,
                }
              : m
          )
        );
      }
      setPresentialClaimResult(data);
      setShowPresentialModal(true);
    } catch {
      setPresentialClaimResult({
        ok: false,
        message:
          "Error de conexión al registrar tu llegada. Por favor reintentá.",
      });
      setShowPresentialModal(true);
    } finally {
      setPresentialClaiming(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] w-full bg-[#090414] flex flex-col md:flex-row items-center justify-center md:gap-6 md:p-4 overflow-hidden"
      style={
        {
          "--brand-primary": brand.primaryColor,
          "--brand-secondary": brand.secondaryColor,
        } as React.CSSProperties
      }
    >
      {/* 9:16 VERTICAL ARCADE MOBILE VIEWPORT (Logical 360x640 -> 1080x1920) */}
      <main
        className="relative w-full h-[100dvh] md:w-[420px] md:h-[min(94dvh,860px)] md:rounded-2xl md:border-4 overflow-hidden flex flex-col bg-[#140b29] shadow-[0_0_50px_rgba(168,85,247,0.3)]"
        style={{ borderColor: brand.primaryColor }}
      >
        <div className="relative flex-1 w-full h-full">
          <ArcadeMap
            centerLat={coords.lat}
            centerLng={coords.lng}
            zoom={16.2}
            primaryColor={brand.primaryColor}
            secondaryColor={brand.secondaryColor}
            mode="player"
            onCanvasReady={(c) => {
              mapCanvasRef.current = c;
            }}
          />

          <RadarCanvasOverlay
            thermalState={currentThermal}
            inVehicleMode={Boolean(pingData?.inVehicleMode)}
            dangerAlertActive={Boolean(pingData?.dangerAlert?.active)}
            speedKmh={pingData?.speedKmh ?? 0}
            coords={coords}
            primaryColor={brand.primaryColor}
            secondaryColor={brand.secondaryColor}
            active={preloaderDismissed}
            onCanvasReady={handleOverlayCanvasReady}
          />

          <div className="crt-scanlines pointer-events-none absolute inset-0 z-10 opacity-18" />

          {/* TOP HUD (Retrofuturistic Cockpit Chassis) */}
          <header className="absolute top-0 inset-x-0 z-20 p-2 space-y-1.5">
            <div className="rf-panel rf-panel-cyan p-2 relative overflow-hidden flex items-center justify-between gap-2 shadow-2xl">
              {/* Top-Right Hazard Warning Caution Accent */}
              <div className="absolute top-0 right-0 w-20 h-2 rf-hazard-stripes-cyan border-b border-l border-cyan-500/50" />

              {/* Left: Brand Identity & Hunter Alias */}
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <div
                  className="w-8 h-8 rounded border-2 flex items-center justify-center shrink-0 text-cyan-300 shadow-inner"
                  style={{
                    borderColor: brand.primaryColor,
                    backgroundColor: `${brand.primaryColor}22`,
                  }}
                >
                  <BrandIconSvg
                    iconKey={brand.logoEmoji}
                    className="w-4 h-4"
                  />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <h1 className="font-handjet font-black text-base uppercase tracking-wider text-white truncate">
                      {brand.name}
                    </h1>
                    {brand.requireAdult18 && (
                      <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-amber-400 text-slate-950 border border-amber-600">
                        +18
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-cyan-300 truncate flex items-center gap-1 font-mono">
                    {hunter ? (
                      <>
                        <span>{hunter.alias}</span>
                        <span>•</span>
                        {wakeLockActive && (
                          <Sun className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                        )}
                        <span>{wakeLockActive ? "WakeLock" : "GPS"}</span>
                      </>
                    ) : (
                      <span>Radar Quest PY</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Right: Retrofuturistic Micro-Buttons */}
              <div className="flex items-center gap-1.5 shrink-0 z-10">
                <div className="px-2 py-1 rf-nameplate text-[10px] text-cyan-300 font-bold border-cyan-500/50 flex items-center gap-1">
                  <Users className="w-3 h-3 text-cyan-400" />
                  <span>{pingData?.activeHuntersCount ?? 1}</span>
                </div>

                <button
                  type="button"
                  onClick={handleSubscribeDropsPush}
                  disabled={pushLoading}
                  className={`p-1.5 rf-btn-steel text-xs ${
                    pushSubscribed
                      ? "border-emerald-400 text-emerald-300"
                      : "text-amber-300"
                  }`}
                  title="Alertas Push de Drops"
                >
                  {pushSubscribed ? (
                    <BellRing className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Bell className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={toggleAudio}
                  className="p-1.5 rf-btn-steel text-xs"
                  title="Audio Chiptune 8-Bit"
                >
                  {muted ? (
                    <VolumeX className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                  )}
                </button>
              </div>
            </div>

            {pushBannerMsg && (
              <div className="px-2.5 py-1.5 rounded bg-emerald-950/95 border border-emerald-400 text-emerald-200 text-[10px] font-semibold flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
                <span>{pushBannerMsg}</span>
              </div>
            )}

            {/* ACTIVE MISSION DISPLAY (LOCK TO THE CURRENT HUNT, NO BULKY FULL-SCREEN DROPDOWN) */}
            {selectedMission && (
              <div className="rf-panel rf-panel-cyan px-2.5 py-1.5 flex items-center justify-between gap-2 shadow-md">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <p className="font-handjet font-extrabold text-xs uppercase tracking-wide text-white truncate">
                    <span className="text-cyan-400 font-bold">
                      [{selectedMission.city}]
                    </span>{" "}
                    <span>{selectedMission.title}</span>
                  </p>
                </div>
                <span className="rf-nameplate text-[9px] text-emerald-300 shrink-0 py-0.5 px-1.5 border-emerald-500/50">
                  {selectedMission.status === "CAPTURED"
                    ? "CAPTURADO"
                    : "DROP ACTIVO"}
                </span>
              </div>
            )}

            {/* THERMAL HUD STATUS BADGE WITH HEAVY BLACK TYPOGRAPHY */}
            <div
              className="px-3 py-1.5 rf-panel text-center shadow-2xl transition-all flex items-center justify-center gap-2.5 overflow-hidden relative"
              style={{
                backgroundColor: thermalStyle.bg,
                borderColor: thermalStyle.border,
                color: thermalStyle.text,
              }}
            >
              {currentThermal === "QUEMANDO" && (
                <div className="absolute top-0 right-0 w-24 h-2.5 rf-hazard-stripes" />
              )}
              <ThermalStatusIcon state={currentThermal} />
              <div className="flex items-baseline gap-2">
                <span className="font-handjet font-black text-xl md:text-2xl tracking-widest uppercase leading-none drop-shadow-[0_2px_0_rgba(0,0,0,0.85)]">
                  {thermalStyle.title}
                </span>
                <span className="font-handjet font-bold text-xs uppercase tracking-wider opacity-95">
                  {thermalStyle.subtitle}
                </span>
              </div>
            </div>

            {pingData?.dangerAlert?.active && (
              <div className="px-3 py-1.5 rounded bg-red-600/95 border-2 border-yellow-300 text-white text-[11px] font-extrabold flex items-center gap-2 animate-pulse shadow-lg">
                <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-300" />
                <span>{pingData.dangerAlert.message}</span>
              </div>
            )}

            {pingData?.inVehicleMode && pingData.vehicleMessage && (
              <div className="px-2.5 py-1.5 rounded bg-amber-950/95 border border-amber-400 text-amber-200 text-[11px] flex items-start gap-2">
                <Car className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" />
                <span>{pingData.vehicleMessage}</span>
              </div>
            )}

            {pingData?.thermalState === "TELEPORT_ANOMALY" &&
              pingData.anomalyMessage && (
                <div className="px-2.5 py-1.5 rounded bg-red-950/95 border border-red-400 text-red-200 text-[11px] flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{pingData.anomalyMessage}</span>
                </div>
              )}
          </header>

          {/* BOTTOM ARCADE CONTROLS */}
          <footer className="absolute bottom-0 inset-x-0 z-20 p-2.5 space-y-2 bg-gradient-to-t from-[#090314] via-[#0d061f]/95 to-transparent">
            {selectedMission && (
              <div className="p-2.5 rf-panel rf-panel-gold relative overflow-hidden space-y-1.5 shadow-xl">
                {/* Top-Right Hazard Caution Tab */}
                <div className="absolute top-0 right-0 w-20 h-2.5 rf-hazard-stripes border-b border-l border-amber-600/70" />

                <div className="flex items-center justify-between gap-2 text-[10px] pr-20">
                  <span className="font-handjet text-sm font-bold uppercase text-amber-300 tracking-wide truncate flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {selectedMission.prizeTitle}
                    </span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  <strong className="text-cyan-300">Pista:</strong>{" "}
                  {selectedMission.zoneHint
                    ? selectedMission.zoneHint
                        .replace(/para\s+hallar\s+el\s+QR\s+oculto/gi, "para hallar el tesoro")
                        .replace(/para\s+hallar\s+el\s+QR/gi, "para hallar el tesoro")
                        .replace(/el\s+QR\s+oculto/gi, "el tesoro")
                    : `Seguí las ondas térmicas en ${selectedMission.city} para hallar el tesoro.`}
                </p>

                {/* TACTICAL VECTOR ASSISTANCE (Dynamic Walking Kinematics & Typewriter HUD) */}
                <TacticalVectorReadout
                  tacticalHint={pingData?.tacticalHint}
                  inVehicleMode={Boolean(pingData?.inVehicleMode)}
                  speedKmh={pingData?.speedKmh ?? 0}
                />
              </div>
            )}

            {showSimBar && (
              <div className="p-2.5 rf-panel rf-panel-cyan space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-cyan-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>SIMULADOR QA (MODO DEMO PC)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setGpsMode("real")}
                    className={`px-2 py-0.5 rf-btn-steel text-[9px] ${
                      gpsMode === "real" ? "opacity-100" : "opacity-60"
                    }`}
                  >
                    Usar GPS Real
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => triggerDemoStep("CONGELADO")}
                    className="py-1 px-1.5 rf-btn-cyan text-[10px] flex items-center justify-center gap-1"
                  >
                    <Snowflake className="w-3 h-3" />
                    <span>Congelado</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerDemoStep("TIBIO")}
                    className="py-1 px-1.5 rf-btn-gold text-[10px] flex items-center justify-center gap-1"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Tibio</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerDemoStep("CALIENTE")}
                    className="py-1 px-1.5 rf-btn-gold text-[10px] flex items-center justify-center gap-1"
                  >
                    <Thermometer className="w-3 h-3" />
                    <span>Caliente</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerDemoStep("QUEMANDO")}
                    className="py-1 px-1.5 rf-btn-crimson text-[10px] flex items-center justify-center gap-1"
                  >
                    <Flame className="w-3 h-3" />
                    <span>¡Quemando!</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerDemoStep("VEHICLE")}
                    className="py-1 px-1.5 rf-btn-steel text-[10px] flex items-center justify-center gap-1"
                  >
                    <Car className="w-3 h-3" />
                    <span>Auto 75km/h</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerDemoStep("TELEPORT")}
                    className="py-1 px-1.5 rf-btn-crimson text-[10px] flex items-center justify-center gap-1"
                  >
                    <ShieldAlert className="w-3 h-3" />
                    <span>Teleport</span>
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons Row */}
            <div className="flex items-center justify-between gap-2">
              <ViralRecorder
                brand={brand}
                mission={selectedMission}
                hunterAlias={hunter?.alias || "@cazador"}
                thermalState={currentThermal}
                activeHunters={pingData?.activeHuntersCount ?? 1}
                getMapCanvas={() => mapCanvasRef.current}
                getOverlayCanvas={() => overlayCanvasRef.current}
              />

              <div className="flex items-center gap-1.5">
                {(process.env.NODE_ENV !== "production" ||
                  (typeof window !== "undefined" &&
                    window.location.search.includes("debug=1"))) && (
                  <button
                    type="button"
                    onClick={() => setShowSimBar((s) => !s)}
                    className="p-2 rf-btn-steel text-cyan-300"
                    title="Simulador GPS QA"
                  >
                    <Gamepad2 className="w-4 h-4" />
                  </button>
                )}

                {/* PRESENTIAL GPS CLAIM BUTTON (When PRESENTIAL_GPS or HYBRID) */}
                {missionValidationMode !== "QR_SCAN" &&
                  (canClaimPresential ? (
                    <button
                      type="button"
                      onClick={handlePresentialClaim}
                      disabled={presentialClaiming}
                      className="px-3.5 py-2 rf-btn-emerald text-xs leading-none"
                    >
                      <span>
                        {presentialClaiming
                          ? "REGISTRANDO..."
                          : "¡LLEGUÉ AL PUNTO!"}
                      </span>
                    </button>
                  ) : (
                    missionValidationMode === "PRESENTIAL_GPS" && (
                      <button
                        type="button"
                        disabled
                        className="px-3 py-2 rf-btn-steel text-[10px] leading-none opacity-60 cursor-not-allowed select-none"
                        title="Se habilita al llegar al punto secreto (<30m a pie)"
                      >
                        <span>LLEGAR AL PUNTO (&lt;30M)</span>
                      </button>
                    )
                  ))}

                {/* PHASE 2 IN-APP CAMERA SCANNER: Interactive ONLY when QUEMANDO (<30m & <20 km/h) AND not pure PRESENTIAL */}
                {missionValidationMode !== "PRESENTIAL_GPS" &&
                  (canOpenScanner ? (
                    <button
                      type="button"
                      onClick={() => setShowInAppScanner(true)}
                      className="px-3.5 py-2 rf-btn-gold text-xs leading-none"
                    >
                      <span>ESCANEAR QR</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="px-3 py-2 rf-btn-steel text-[10px] leading-none opacity-60 cursor-not-allowed select-none"
                      title="Se habilita únicamente en estado ¡QUEMANDO! (<30m y a pie <20 km/h)"
                    >
                      <span>ESCANEAR (&lt;30M)</span>
                    </button>
                  ))}
              </div>
            </div>
          </footer>

          {/* CLIMAX VICTORY FLOATING MODAL (<30m) */}
          {currentThermal === "QUEMANDO" &&
            (selectedMission?.status === "ACTIVE" || selectedMission?.status === "CAPTURED") &&
            !victoryBannerDismissed &&
            !showInAppScanner &&
            !showPresentialModal &&
            !showExternalClaimModal && (
              <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="relative w-full max-w-xs sm:max-w-sm p-5 rf-victory-banner-frame text-center space-y-4">
                  {/* Close / Dismiss button */}
                  <button
                    type="button"
                    onClick={() => setVictoryBannerDismissed(true)}
                    className="absolute top-2.5 right-2.5 p-1.5 text-slate-400 hover:text-white rounded-lg bg-black/50 hover:bg-black/80 transition"
                    aria-label="Cerrar modal de victoria"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* 16-bit Victory Chest Sprite from PixelLab */}
                  <div className="pt-2 flex justify-center">
                    <img
                      src="/sprites/golden_chest_victory.png"
                      alt="Cofre Dorado Victorioso"
                      className="rf-victory-chest w-24 h-24 object-contain pointer-events-none drop-shadow-[0_0_20px_rgba(250,204,21,0.7)]"
                    />
                  </div>

                  {/* Victory Headers & Climax Messaging */}
                  <div className="space-y-1">
                    {selectedMission?.status === "CAPTURED" ? (
                      <>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-300 font-pixel text-[11px] animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>PREMIO MAYOR YA RECLAMADO</span>
                        </div>
                        <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-300 to-cyan-300 font-pixel tracking-wide">
                          ¡LLEGASTE AL LUGAR SECRETO!
                        </h2>
                        <p className="text-xs text-slate-200 leading-snug">
                          El Premio Mayor ya fue reclamado por{" "}
                          <strong className="text-yellow-300">
                            {selectedMission.winnerAlias || "otro cazador"}
                          </strong>
                          . ¡Pero completaste la búsqueda física! Registrá tu llegada para canjear tu{" "}
                          <strong className="text-cyan-300">Premio Oficial de Consuelo</strong>.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 font-pixel text-[11px] animate-pulse">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>¡ESTÁS QUEMANDO!</span>
                        </div>
                        <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-pink-400 font-pixel tracking-wide">
                          ¡LLEGASTE AL TESORO!
                        </h2>
                        <p className="text-xs text-slate-200 leading-snug">
                          Estás a menos de <strong>30 metros</strong> del premio secreto.
                          ¡Realiza la captura ahora antes de que otro cazador lo reclame!
                        </p>
                      </>
                    )}
                  </div>

                  {/* Primary Action Button (Single-Tap Victory Claim) */}
                  <div className="space-y-2 pt-1">
                    {missionValidationMode !== "PRESENTIAL_GPS" && (
                      <button
                        type="button"
                        onClick={() => {
                          setVictoryBannerDismissed(true);
                          setShowInAppScanner(true);
                        }}
                        className="w-full py-3.5 px-4 rf-btn-gold text-xs font-black flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(250,204,21,0.55)] cursor-pointer"
                      >
                        <QrCode className="w-5 h-5 shrink-0" />
                        <span>
                          {selectedMission?.status === "CAPTURED"
                            ? "ESCANEAR QR (RECLAMAR CONSUELO)"
                            : "ESCANEAR CÓDIGO QR AHORA"}
                        </span>
                      </button>
                    )}

                    {missionValidationMode !== "QR_SCAN" && (
                      <button
                        type="button"
                        onClick={() => {
                          setVictoryBannerDismissed(true);
                          handlePresentialClaim();
                        }}
                        disabled={presentialClaiming}
                        className="w-full py-3.5 px-4 rf-btn-emerald text-xs font-black flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.55)] cursor-pointer"
                      >
                        <Sparkles className="w-5 h-5 shrink-0" />
                        <span>
                          {presentialClaiming
                            ? "REGISTRANDO CAPTURA..."
                            : selectedMission?.status === "CAPTURED"
                            ? "¡LLEGUÉ AL PUNTO! (RECLAMAR CONSUELO)"
                            : "¡LLEGUÉ AL PUNTO! REGISTRARME"}
                        </span>
                      </button>
                    )}

                    <p className="text-[10px] text-slate-400 font-mono">
                      {missionValidationMode === "QR_SCAN"
                        ? "Enfoca la cámara hacia el cartel o sticker oficial de la marca."
                        : missionValidationMode === "PRESENTIAL_GPS"
                        ? "El equipo de la marca te entregará el premio en el punto."
                        : "Puedes escanear el QR o registrar tu llegada directa."}
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* 3-SECOND ARCADE ONBOARDING GATE */}
          {!checkingSession && !hunter && (
            <OnboardingModal
              brand={brand}
              sourceMissionId={selectedMission?.id || null}
              onComplete={(registeredHunter, token) => {
                setHunter(registeredHunter);
                setSessionToken(token);
              }}
            />
          )}

          {/* PHASE 2 IN-APP RETRO-ARCADE CAMERA SCANNER OVERLAY */}
          {showInAppScanner && hunter && (
            <ArcadeQrScannerModal
              brand={brand}
              hunter={hunter}
              sessionToken={sessionToken}
              currentCoords={coords}
              demoTokenHint={demoQrHint}
              onClose={() => setShowInAppScanner(false)}
              onClaimSuccess={(res) => {
                if (res.claim?.claimType === "MAJOR_PRIZE" && selectedMission) {
                  setMissions((prev) =>
                    prev.map((m) =>
                      m.id === selectedMission.id
                        ? {
                            ...m,
                            status: "CAPTURED",
                            winnerAlias: hunter.alias,
                          }
                        : m
                    )
                  );
                }
              }}
            />
          )}

          {/* PRESENTIAL GPS CLAIM VICTORY MODAL */}
          {showPresentialModal && hunter && (
            <QrClaimModal
              brand={brand}
              hunter={hunter}
              sessionToken={sessionToken}
              currentCoords={coords}
              initialResult={presentialClaimResult}
              onClose={() => setShowPresentialModal(false)}
            />
          )}

          {/* DIRECT EXTERNAL URL QR CLAIM MODAL (/b/[brand]/claim?token=...) */}
          {showExternalClaimModal && hunter && (
            <QrClaimModal
              brand={brand}
              hunter={hunter}
              sessionToken={sessionToken}
              currentCoords={coords}
              suggestedCode={demoQrHint}
              onClose={() => setShowExternalClaimModal(false)}
            />
          )}

          {/* RETROFUTURISTIC PRELOADER & AUDIO SYNC SCREEN */}
          {!preloaderDismissed && (
            <RadarPreloader
              brandName={brand.name}
              brandIconKey={brand.logoEmoji}
              brandLogoUrl={brand.logoUrl}
              brandPrimaryColor={brand.primaryColor}
              onStart={() => setPreloaderDismissed(true)}
            />
          )}
        </div>
      </main>

      {/* DESKTOP SIDEBAR COMPANION */}
      <aside className="hidden lg:flex flex-col w-80 p-5 rounded-2xl bg-[#140b29]/90 border border-purple-500/40 space-y-4 text-slate-200">
        <div>
          <p className="font-pixel text-[10px] text-cyan-300 uppercase mb-1">
            EMULACIÓN VERTICAL 9:16
          </p>
          <h2 className="text-lg font-extrabold text-white">
            Radar Quest • {brand.name}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            En celulares ocupa el 100dvh nativo con Wake Lock, alertas Web Push
            por ciudad y escáner óptico en estado ¡QUEMANDO! (&lt;30m).
          </p>
        </div>

        <div className="p-3 rounded-xl bg-[#0d061c] border border-purple-500/30 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <Flame className="w-4 h-4" />
            <span>Telemetría en Tiempo Real</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Modo GPS:</span>
            <span className="font-mono text-cyan-300 uppercase">{gpsMode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Velocidad:</span>
            <span className="font-mono">{pingData?.speedKmh ?? 0} km/h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Escáner In-App:</span>
            <span
              className={`font-mono font-bold ${
                canOpenScanner ? "text-amber-300" : "text-slate-500"
              }`}
            >
              {canOpenScanner ? "DESBLOQUEADO" : "BLOQUEADO (>30m)"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Alertas Web Push:</span>
            <span
              className={`font-mono font-bold ${
                pushSubscribed ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {pushSubscribed ? "SUSCRIPTO" : "DISPONIBLE"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubscribeDropsPush}
          disabled={pushLoading}
          className="w-full py-2.5 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
        >
          <BellRing className="w-4 h-4 text-emerald-300" />
          <span>
            {pushSubscribed
              ? `Push Activo (${selectedMission?.city || brand.cityDefault})`
              : `Activar Push en ${selectedMission?.city || brand.cityDefault}`}
          </span>
        </button>

        <div className="space-y-2 pt-1">
          <Link
            href={`/b/${brand.slug}/admin`}
            className="w-full py-2.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
          >
            <Radio className="w-4 h-4" />
            <span>Panel Comercio (/b/{brand.slug}/admin)</span>
          </Link>
          <Link
            href="/admin"
            className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition"
          >
            <Compass className="w-4 h-4" />
            <span>Super-Admin (/admin)</span>
          </Link>
        </div>
      </aside>
    </div>
  );
}
