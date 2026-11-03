"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  BellRing,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Crosshair,
  Download,
  Edit,
  ExternalLink,
  Flame,
  Layers,
  Link2,
  LogOut,
  MapPin,
  Megaphone,
  Percent,
  PlusCircle,
  QrCode,
  Radio,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Smartphone,
  Trash2,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import type {
  BrandAnalyticsSummary,
  BrandLead,
  HeatmapPoint,
  HunterMissionTelemetry,
  Mission,
  MissionClaim,
  PublicBrand,
  ReusableQrNode,
  ValidationMode,
} from "@/types/radar";
import {
  extractCoordinatesFromInput,
  PARAGUAY_CITIES,
} from "@/lib/radar/geo";
import { ArcadeMap } from "@/components/radar/ArcadeMap";
import { BrandIconSvg } from "@/components/icons/BrandIconSvg";

interface LiveHunterRow extends HunterMissionTelemetry {
  isDemoBot?: boolean;
  missionTitle?: string;
  missionCity?: string;
}

interface PushDispatchSummary {
  missionId: string;
  missionTitle: string;
  city: string;
  targetedCount: number;
  sentCount: number;
  dispatchedAt: string;
}

interface LiveCommandPayload {
  ok: boolean;
  polledAt: string;
  brand: PublicBrand;
  selectedMission: Mission | null;
  missions: Mission[];
  stats: {
    connectedHunters: number;
    huntersInCaptureZone: number;
    totalLeads: number;
    verifiedAdultLeads: number;
    totalClaims: number;
    anomaliesDetected: number;
  };
  leaderboard: LiveHunterRow[];
  recentLeads: BrandLead[];
  recentClaims: MissionClaim[];
  analytics?: BrandAnalyticsSummary;
  heatmapPoints?: HeatmapPoint[];
  pushDispatchLogs?: PushDispatchSummary[];
}

interface BrandAdminClientProps {
  initialBrand: PublicBrand;
  initialMissions: Mission[];
  initialNodes: ReusableQrNode[];
  initialAnalytics?: BrandAnalyticsSummary;
  initialHeatmapPoints?: HeatmapPoint[];
}

const DEFAULT_ANALYTICS: BrandAnalyticsSummary = {
  uniqueHunters: 0,
  avgCaptureMinutes: null,
  claimConversionRate: 0,
  totalHistoricalPings: 0,
  pushSubscribersCount: 0,
};

export function BrandAdminClient({
  initialBrand,
  initialMissions,
  initialNodes,
  initialAnalytics = DEFAULT_ANALYTICS,
  initialHeatmapPoints = [],
}: BrandAdminClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"live" | "builder" | "qrs">("live");
  const [brand, setBrand] = useState<PublicBrand>(initialBrand);
  const [missions, setMissions] = useState<Mission[]>(initialMissions);
  const [nodes, setNodes] = useState<ReusableQrNode[]>(initialNodes);
  const [selectedMissionId, setSelectedMissionId] = useState<string>(
    initialMissions.find((m) => m.status === "ACTIVE")?.id ||
      initialMissions[0]?.id ||
      ""
  );

  // Live Command Center + BI Heatmap State (polled every 3 seconds)
  const [liveData, setLiveData] = useState<LiveCommandPayload | null>(null);
  const [analytics, setAnalytics] =
    useState<BrandAnalyticsSummary>(initialAnalytics);
  const [heatmapPoints, setHeatmapPoints] =
    useState<HeatmapPoint[]>(initialHeatmapPoints);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [heatmapScope, setHeatmapScope] = useState<"brand" | "mission">("brand");
  const [lastPollStr, setLastPollStr] = useState<string>("--:--:--");

  // Social / WhatsApp Copy Generator Feedback
  const [copiedMissionId, setCopiedMissionId] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Mission Builder State (Modo Campo GPS & Modo Escritorio Mapa/Links)
  const defaultCity =
    PARAGUAY_CITIES.find((c) => c.name === initialBrand.cityDefault) ||
    PARAGUAY_CITIES[0];

  const [pinLat, setPinLat] = useState<number>(defaultCity.lat);
  const [pinLng, setPinLng] = useState<number>(defaultCity.lng);
  const [gpsAccuracyReport, setGpsAccuracyReport] = useState<string | null>(
    null
  );
  const [locatingFieldGps, setLocatingFieldGps] = useState(false);
  const [mapsLinkInput, setMapsLinkInput] = useState("");
  const [linkExtractFeedback, setLinkExtractFeedback] = useState<string | null>(
    null
  );

  const [title, setTitle] = useState("");
  const [city, setCity] = useState(defaultCity.name);
  const [zoneHint, setZoneHint] = useState("");
  const [prizeTitle, setPrizeTitle] = useState("");
  const [consolationTitle, setConsolationTitle] = useState(
    "Cupón Explorador Curioso - 15% OFF"
  );
  const [selectedNodeCode, setSelectedNodeCode] = useState("");
  const [minPings, setMinPings] = useState(3);
  const [validationMode, setValidationMode] = useState<ValidationMode>("HYBRID");
  const [savingMission, setSavingMission] = useState(false);
  const [builderFeedback, setBuilderFeedback] = useState<string | null>(null);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [deletingMission, setDeletingMission] = useState<Mission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const pollLiveCommandCenter = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        brandSlug: brand.slug,
        missionId: selectedMissionId,
      });
      const res = await fetch(`/api/admin/live?${qs.toString()}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        router.refresh();
        return;
      }
      const data = (await res.json()) as LiveCommandPayload;
      if (data.ok) {
        setLiveData(data);
        setBrand(data.brand);
        setMissions(data.missions);
        if (data.analytics) setAnalytics(data.analytics);
        if (data.heatmapPoints) setHeatmapPoints(data.heatmapPoints);
        setLastPollStr(
          new Date(data.polledAt).toLocaleTimeString("es-PY", { hour12: false })
        );
      }
    } catch {}
  }, [brand.slug, router, selectedMissionId]);

  // Poll every 3 seconds as required by Live Command Center specification
  useEffect(() => {
    pollLiveCommandCenter();
    const timer = window.setInterval(pollLiveCommandCenter, 3000);
    return () => window.clearInterval(timer);
  }, [pollLiveCommandCenter]);

  const originUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://radarquest.com.py";

  // Generador de Copy para WhatsApp / Instagram (con emojis para el texto plano de difusión)
  const handleCopySocialAd = async (mission: Mission) => {
    const directMissionUrl = `${originUrl}/b/${brand.slug}?mission=${encodeURIComponent(
      mission.id
    )}`;

    const announcementText = [
      `🚨🔥 ¡NUEVO DROP ACTIVADO EN ${mission.city.toUpperCase()}! 🔥🚨`,
      ``,
      `🎯 Misión: *${mission.title}*`,
      `🏆 Premio Mayor: *${mission.prizeTitle}*`,
      `🎁 Consuelo: ${mission.consolationTitle}`,
      ``,
      `🧭 *PISTA INICIAL:*`,
      `"${mission.zoneHint}"`,
      ``,
      `📡 Abrí el Radar Térmico en vivo, rastreá la señal en la calle y escaneá el QR oculto antes que nadie:`,
      `👉 ${directMissionUrl}`,
      ``,
      `⚡ Organiza: *${brand.name}*${brand.requireAdult18 ? " (+18)" : ""}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(announcementText);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = announcementText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopiedMissionId(mission.id);
    setCopyToast(
      `Anuncio de "${mission.title}" copiado al portapapeles listo para WhatsApp / Instagram.`
    );
    window.setTimeout(() => {
      setCopiedMissionId((curr) => (curr === mission.id ? null : curr));
      setCopyToast(null);
    }, 3500);
  };

  // MODO CAMPO (Celular): High-precision GPS Lock right where physical QR is placed
  const handleFieldGpsPin = (updateSelectedMission = false) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsAccuracyReport("Geolocalización no soportada en este navegador.");
      return;
    }
    setLocatingFieldGps(true);
    setGpsAccuracyReport(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy || 5);
        setPinLat(lat);
        setPinLng(lng);
        setGpsAccuracyReport(
          `Ubicación GPS fijada con alta precisión (±${acc}m): ${lat}, ${lng}`
        );
        setLocatingFieldGps(false);

        if (updateSelectedMission && selectedMissionId) {
          await fetch("/api/admin/missions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              missionId: selectedMissionId,
              secretLat: lat,
              secretLng: lng,
            }),
          });
          pollLiveCommandCenter();
        }
      },
      (err) => {
        setLocatingFieldGps(false);
        setGpsAccuracyReport(
          `No se pudo obtener GPS (${err.message}). Verificá permisos de ubicación.`
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  // MODO ESCRITORIO (PC): Extract coordinates from Google Maps / WhatsApp link
  const handleExtractFromLink = () => {
    const parsed = extractCoordinatesFromInput(mapsLinkInput);
    if (!parsed) {
      setLinkExtractFeedback(
        "No encontramos coordenadas en ese enlace. Pegá un link completo de Google Maps, ubicación de WhatsApp o formato '-27.3308, -55.8669'."
      );
      return;
    }
    setPinLat(Number(parsed.lat.toFixed(6)));
    setPinLng(Number(parsed.lng.toFixed(6)));
    setLinkExtractFeedback(
      `Coordenadas extraídas con éxito: ${parsed.lat.toFixed(
        6
      )}, ${parsed.lng.toFixed(6)}`
    );
  };

  const handleCityPresetChange = (cityName: string) => {
    setCity(cityName);
    const preset = PARAGUAY_CITIES.find((c) => c.name === cityName);
    if (preset) {
      setPinLat(preset.lat);
      setPinLng(preset.lng);
    }
  };

  const handleStartEditMission = (m: Mission) => {
    setEditingMission(m);
    setTitle(m.title);
    setCity(m.city);
    setZoneHint(m.zoneHint);
    setPrizeTitle(m.prizeTitle);
    setConsolationTitle(m.consolationTitle);
    setMinPings(m.minPingsForMajorPrize);
    setValidationMode(m.validationMode);
    setSelectedNodeCode(m.nodeCode || "");
    setPinLat(m.secretLat);
    setPinLng(m.secretLng);
    setBuilderFeedback(null);
    setActiveTab("builder");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 400, behavior: "smooth" });
    }
  };

  const handleCancelEdit = () => {
    setEditingMission(null);
    setTitle("");
    setZoneHint("");
    setPrizeTitle("");
    setConsolationTitle("Cupón Explorador Curioso - 15% OFF");
    setMinPings(3);
    setSelectedNodeCode("");
    setBuilderFeedback(null);
  };

  const handleSaveMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMission(true);
    setBuilderFeedback(null);

    try {
      if (editingMission) {
        // Modo Edición: Actualizar ubicación y parámetros de la misión existente
        const res = await fetch("/api/admin/missions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            missionId: editingMission.id,
            title,
            city,
            zoneHint,
            secretLat: pinLat,
            secretLng: pinLng,
            prizeTitle,
            consolationTitle,
            nodeCode: selectedNodeCode || null,
            minPingsForMajorPrize: minPings,
            validationMode,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setBuilderFeedback(data.message || "Error al actualizar misión.");
          setSavingMission(false);
          return;
        }

        // Actualizar lista local
        setMissions((prev) =>
          prev.map((m) => (m.id === data.mission.id ? data.mission : m))
        );
        setBuilderFeedback(
          `Misión "${data.mission.title}" actualizada exitosamente. Nueva ubicación fijada y zona difusa recalculada.`
        );
        setEditingMission(null);
        handleCancelEdit();
        await pollLiveCommandCenter();
      } else {
        // Modo Creación: Nueva misión (-1 crédito)
        const res = await fetch("/api/admin/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandSlug: brand.slug,
            title,
            city,
            zoneHint,
            secretLat: pinLat,
            secretLng: pinLng,
            prizeTitle,
            consolationTitle,
            nodeCode: selectedNodeCode || null,
            minPingsForMajorPrize: minPings,
            validationMode,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setBuilderFeedback(data.message || "Error al crear misión.");
          setSavingMission(false);
          return;
        }

        setTitle("");
        setZoneHint("");
        setPrizeTitle("");
        setSelectedMissionId(data.mission.id);
        setBrand((prev) => ({
          ...prev,
          missionCredits: data.remainingCredits,
        }));
        setBuilderFeedback(
          `Misión "${data.mission.title}" activada en ${data.mission.city}. Notificación Web Push disparada a suscriptores locales. Créditos restantes: ${data.remainingCredits}.`
        );
        await pollLiveCommandCenter();
        const mRes = await fetch(
          `/api/admin/missions?brandSlug=${encodeURIComponent(brand.slug)}`
        );
        const mJson = await mRes.json();
        if (mJson.ok) setNodes(mJson.reusableNodes);
      }
    } catch {
      setBuilderFeedback("Error de red guardando misión.");
    } finally {
      setSavingMission(false);
    }
  };

  const handleDeleteMission = async () => {
    if (!deletingMission) return;
    setIsDeleting(true);

    try {
      const res = await fetch(
        `/api/admin/missions?missionId=${encodeURIComponent(deletingMission.id)}`,
        {
          method: "DELETE",
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.message || "Error al eliminar la misión.");
        setIsDeleting(false);
        return;
      }

      const deletedId = deletingMission.id;
      setMissions((prev) => prev.filter((m) => m.id !== deletedId));
      if (data.refundedCredit) {
        setBrand((prev) => ({
          ...prev,
          missionCredits: data.remainingCredits,
        }));
      }

      if (selectedMissionId === deletedId) {
        const remaining = missions.filter((m) => m.id !== deletedId);
        setSelectedMissionId(remaining[0]?.id || "");
      }

      setDeletingMission(null);
      await pollLiveCommandCenter();
    } catch {
      alert("Error de red al intentar eliminar la misión.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleMissionStatus = async (
    mission: Mission,
    nextStatus: "ACTIVE" | "PAUSED",
    resetWinner = false
  ) => {
    await fetch("/api/admin/missions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        missionId: mission.id,
        status: nextStatus,
        resetWinner,
      }),
    });
    pollLiveCommandCenter();
  };

  const selectedMission =
    missions.find((m) => m.id === selectedMissionId) || missions[0] || null;

  const filteredHeatmapPoints = useMemo(() => {
    if (heatmapScope === "mission" && selectedMission) {
      return heatmapPoints.filter((pt) => pt.missionId === selectedMission.id);
    }
    return heatmapPoints;
  }, [heatmapPoints, heatmapScope, selectedMission]);

  return (
    <div className="min-h-screen bg-[#0b0518] text-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* TOP MERCHANT HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#140b29] border border-purple-500/40 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center border-2 text-cyan-300"
              style={{
                borderColor: brand.primaryColor,
                backgroundColor: `${brand.primaryColor}22`,
              }}
            >
              <BrandIconSvg iconKey={brand.logoEmoji} className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-pixel text-[10px] text-cyan-300 uppercase">
                  PANEL DEL COMERCIO • WHITE-LABEL
                </span>
                {brand.requireAdult18 && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-amber-400 text-slate-950">
                    MODO +18 ACTIVO
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-extrabold text-white">
                {brand.name}
              </h1>
              <p className="text-xs text-slate-400">
                Créditos disponibles:{" "}
                <strong className="text-emerald-300">
                  {brand.missionCredits} misiones
                </strong>{" "}
                • Suscriptores Push:{" "}
                <strong className="text-cyan-300">
                  {analytics.pushSubscribersCount}
                </strong>{" "}
                • WhatsApp: {brand.whatsapp}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/admin/leads/export?brandSlug=${encodeURIComponent(
                brand.slug
              )}`}
              className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV de WhatsApps</span>
            </a>

            <Link
              href={`/b/${brand.slug}`}
              className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Abrir Radar Jugador</span>
            </Link>

            <Link
              href="/admin"
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <Compass className="w-4 h-4" />
              <span>Super-Admin</span>
            </Link>

            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/brand-pin", { method: "DELETE" });
                router.refresh();
              }}
              className="px-3 py-2 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Salir</span>
            </button>
          </div>
        </header>

        {/* CLIPBOARD TOAST BANNER */}
        {copyToast && (
          <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{copyToast}</span>
          </div>
        )}

        {/* ================================================================ */}
        {/* INTELIGENCIA DE NEGOCIO (BI ARCADE METRICS - FASE 3)             */}
        {/* ================================================================ */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#170d30] to-[#110824] border-2 border-cyan-400/50 shadow-[0_0_24px_rgba(0,240,255,0.12)] flex items-center justify-between gap-3">
            <div>
              <span className="font-pixel text-[9px] text-cyan-300 uppercase tracking-wider">
                BI • ALCANCE DE MARCA
              </span>
              <p className="text-xs text-slate-300 font-bold mt-1">
                Total de Cazadores Únicos
              </p>
              <p className="text-3xl font-extrabold text-white mt-1">
                {analytics.uniqueHunters}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {analytics.totalHistoricalPings} pings históricos registrados
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#170d30] to-[#110824] border-2 border-purple-500/50 shadow-[0_0_24px_rgba(168,85,247,0.12)] flex items-center justify-between gap-3">
            <div>
              <span className="font-pixel text-[9px] text-purple-300 uppercase tracking-wider">
                BI • VELOCIDAD DE DROP
              </span>
              <p className="text-xs text-slate-300 font-bold mt-1">
                Tiempo Medio de Captura
              </p>
              <p className="text-3xl font-extrabold text-amber-300 mt-1">
                {analytics.avgCaptureMinutes !== null
                  ? `${analytics.avgCaptureMinutes} min`
                  : "En curso"}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Desde activación hasta escaneo ganador
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#170d30] to-[#110824] border-2 border-emerald-400/50 shadow-[0_0_24px_rgba(16,185,129,0.12)] flex items-center justify-between gap-3">
            <div className="flex-1">
              <span className="font-pixel text-[9px] text-emerald-300 uppercase tracking-wider">
                BI • EFECTIVIDAD COMERCIAL
              </span>
              <p className="text-xs text-slate-300 font-bold mt-1">
                Tasa de Conversión de Canjes
              </p>
              <p className="text-3xl font-extrabold text-emerald-300 mt-1">
                {analytics.claimConversionRate}%
              </p>
              <div className="w-full h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-500"
                  style={{
                    width: `${Math.min(100, analytics.claimConversionRate)}%`,
                  }}
                />
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <Percent className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* NAVIGATION TABS */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("live")}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition ${
              activeTab === "live"
                ? "bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(0,240,255,0.4)]"
                : "bg-[#140b29] text-slate-300 border border-purple-500/30 hover:border-cyan-400"
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Live Command Center & Heatmap (3s)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("builder")}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition ${
              activeTab === "builder"
                ? "bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                : "bg-[#140b29] text-slate-300 border border-purple-500/30 hover:border-purple-400"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Autogestión de Misiones (Campo GPS / Mapa PC)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("qrs")}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition ${
              activeTab === "qrs"
                ? "bg-amber-400 text-slate-950"
                : "bg-[#140b29] text-slate-300 border border-purple-500/30 hover:border-amber-400"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Carteles QR Físicos & Difusión Redes</span>
          </button>
        </div>

        {/* ================================================================ */}
        {/* TAB 1: LIVE COMMAND CENTER + HEATMAP + COPY GENERATOR            */}
        {/* ================================================================ */}
        {activeTab === "live" && (
          <div className="space-y-6">
            {/* Live Operational Sub-KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl bg-[#140b29] border border-cyan-500/40">
                <p className="text-[11px] uppercase text-slate-400">
                  Cazadores en Vivo
                </p>
                <p className="text-2xl font-extrabold text-cyan-300 mt-1 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span>{liveData?.stats.connectedHunters ?? 0}</span>
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#140b29] border border-red-500/40">
                <p className="text-[11px] uppercase text-slate-400">
                  En Zona Captura (&le;65m)
                </p>
                <p className="text-2xl font-extrabold text-red-400 mt-1">
                  {liveData?.stats.huntersInCaptureZone ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#140b29] border border-emerald-500/40">
                <p className="text-[11px] uppercase text-slate-400">
                  Leads WhatsApp (+18)
                </p>
                <p className="text-2xl font-extrabold text-emerald-300 mt-1">
                  {liveData?.stats.totalLeads ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#140b29] border border-amber-500/40">
                <p className="text-[11px] uppercase text-slate-400">
                  Cupones Reclamados
                </p>
                <p className="text-2xl font-extrabold text-amber-300 mt-1">
                  {liveData?.stats.totalClaims ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#140b29] border border-pink-500/40 col-span-2 lg:col-span-1">
                <p className="text-[11px] uppercase text-slate-400">
                  Anti-Cheat Bloqueados
                </p>
                <p className="text-2xl font-extrabold text-pink-400 mt-1 flex items-center gap-1.5">
                  <ShieldAlert className="w-5 h-5" />
                  <span>{liveData?.stats.anomaliesDetected ?? 0}</span>
                </p>
              </div>
            </div>

            {/* Mission Filter + Quick Field Re-Pin + WhatsApp/Instagram Ad Copy Button */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-4 rounded-xl bg-[#140b29] border border-purple-500/30">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold uppercase text-cyan-300">
                  Misión Monitoreada:
                </span>
                <select
                  value={selectedMissionId}
                  onChange={(e) => setSelectedMissionId(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#0b0518] border border-purple-500/50 text-sm text-white"
                >
                  {missions.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.city}] {m.title} — ({m.status})
                    </option>
                  ))}
                </select>

                {selectedMission && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleFieldGpsPin(true)}
                      disabled={locatingFieldGps}
                      className="px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition"
                      title="Actualiza las coordenadas secretas de esta misión a tu ubicación GPS actual"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>
                        {locatingFieldGps
                          ? "Leyendo GPS..."
                          : "Mover Tesoro a Mi Ubicación"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEditMission(selectedMission)}
                      className="px-3 py-2 rounded-lg bg-purple-600/40 hover:bg-purple-600/70 border border-purple-400/50 text-purple-200 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition"
                      title="Editar coordenadas secretas o datos de esta misión"
                    >
                      <Edit className="w-4 h-4 text-purple-300" />
                      <span>Editar Misión</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingMission(selectedMission)}
                      className="px-3 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/50 text-red-300 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition"
                      title="Eliminar este drop permanentemente"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <span>Eliminar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopySocialAd(selectedMission)}
                      className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:opacity-95 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-[0_0_16px_rgba(236,72,153,0.35)] cursor-pointer transition"
                    >
                      {copiedMissionId === selectedMission.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Megaphone className="w-4 h-4" />
                      )}
                      <span>
                        {copiedMissionId === selectedMission.id
                          ? "ANUNCIO COPIADO AL PORTAPAPELES"
                          : "GENERAR ANUNCIO PARA WHATSAPP / INSTAGRAM"}
                      </span>
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>Sync en vivo cada 3s • Último: {lastPollStr}</span>
              </div>
            </div>

            {/* Map (with HunterPing Heatmap Layer) + Live Proximity Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Administrative Tracking & Heatmap Map */}
              <div className="lg:col-span-7 rounded-2xl overflow-hidden border-2 border-purple-500/50 bg-[#140b29] flex flex-col h-[500px]">
                <div className="px-4 py-2.5 bg-[#0e0720] border-b border-purple-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>
                      Mapa Administrativo & Heatmap ({selectedMission?.city})
                    </span>
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowHeatmap((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1.5 cursor-pointer border transition ${
                        showHeatmap
                          ? "bg-rose-500/20 border-rose-400 text-rose-200"
                          : "bg-slate-900 border-slate-700 text-slate-400"
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>
                        Heatmap Pings ({filteredHeatmapPoints.length})
                      </span>
                    </button>

                    {showHeatmap && (
                      <button
                        type="button"
                        onClick={() =>
                          setHeatmapScope((s) =>
                            s === "brand" ? "mission" : "brand"
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#140b29] border border-cyan-500/40 text-cyan-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                        title="Alternar entre todos los pings históricos de la marca o solo la misión seleccionada"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>
                          {heatmapScope === "brand"
                            ? "Toda la Marca"
                            : "Solo Misión"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 relative">
                  <ArcadeMap
                    centerLat={selectedMission?.secretLat ?? -27.3308}
                    centerLng={selectedMission?.secretLng ?? -55.8669}
                    zoom={15.4}
                    primaryColor={brand.primaryColor}
                    secondaryColor={brand.secondaryColor}
                    mode="admin-live"
                    showHeatmap={showHeatmap}
                    heatmapPoints={filteredHeatmapPoints}
                    secretPin={
                      selectedMission
                        ? {
                            lat: selectedMission.secretLat,
                            lng: selectedMission.secretLng,
                          }
                        : null
                    }
                    liveHunters={(liveData?.leaderboard || []).map((h) => ({
                      hunterId: h.hunterId,
                      alias: h.alias,
                      lat: h.lastLat,
                      lng: h.lastLng,
                      distanceMeters: h.lastDistanceMeters,
                      inVehicleMode: h.inVehicleMode,
                      thermalState: h.thermalState,
                    }))}
                  />

                  {/* Heatmap Legend Overlay */}
                  {showHeatmap && (
                    <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-lg bg-[#0b0518]/90 border border-purple-500/40 text-[10px] text-slate-200 flex items-center gap-2 pointer-events-none">
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      <span>Densidad HunterPing:</span>
                      <span
                        className="w-20 h-2 rounded-full inline-block"
                        style={{
                          background:
                            "linear-gradient(90deg, #00f0ff 0%, #a855f7 40%, #fb923c 70%, #ff0055 100%)",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Proximity Leaderboard */}
              <div className="lg:col-span-5 rounded-2xl bg-[#140b29] border border-purple-500/40 p-4 flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-sm uppercase tracking-wider text-amber-300 flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    <span>Tabla de Líderes por Cercanía</span>
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    Tiempo Real
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {(liveData?.leaderboard || []).length === 0 ? (
                    <p className="text-xs text-slate-400 py-8 text-center">
                      Aún no hay cazadores conectados en esta misión.
                    </p>
                  ) : (
                    liveData?.leaderboard.map((row, idx) => (
                      <div
                        key={row.id}
                        className="p-3 rounded-xl bg-[#0c061a] border border-purple-500/30 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-purple-600 text-white text-[11px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-sm text-white">
                              {row.alias}
                            </span>
                            {row.inVehicleMode && (
                              <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 inline-flex items-center gap-1">
                                <Car className="w-3 h-3" />
                                <span>{Math.round(row.speedKmh)} km/h</span>
                              </span>
                            )}
                            {row.isDemoBot && (
                              <span className="px-1.5 py-0.5 text-[9px] rounded bg-slate-800 text-slate-400">
                                DEMO
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Estado:{" "}
                            <strong className="text-cyan-300">
                              {row.thermalState}
                            </strong>{" "}
                            • Proof of Hunt: {row.validHuntPings} pings
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-mono text-base font-extrabold text-amber-300">
                            {Math.round(row.lastDistanceMeters)}m
                          </p>
                          <p className="text-[10px] text-slate-500">
                            ±{Math.round(row.lastAccuracy)}m GPS
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Recent Web Push Dispatches Box */}
                {liveData?.pushDispatchLogs &&
                  liveData.pushDispatchLogs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-purple-500/30 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase text-cyan-300 flex items-center gap-1.5">
                        <BellRing className="w-3.5 h-3.5" />
                        <span>Últimos Drops Notificados vía Web Push</span>
                      </p>
                      {liveData.pushDispatchLogs.slice(0, 2).map((log, idx) => (
                        <div
                          key={`${log.missionId}-${idx}`}
                          className="text-[11px] bg-[#0b0518] px-2.5 py-1.5 rounded border border-cyan-500/25 flex items-center justify-between"
                        >
                          <span className="text-slate-200 truncate">
                            [{log.city}] {log.missionTitle}
                          </span>
                          <span className="text-cyan-300 font-mono shrink-0 ml-2">
                            {log.targetedCount} subs
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* Leads Collected & Claims History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-4 rounded-2xl bg-[#140b29] border border-purple-500/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-emerald-300 uppercase flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    <span>Últimos Leads de WhatsApp Capturados</span>
                  </h3>
                  <a
                    href={`/api/admin/leads/export?brandSlug=${encodeURIComponent(
                      brand.slug
                    )}`}
                    className="text-xs text-cyan-300 underline"
                  >
                    Descargar CSV completo
                  </a>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(liveData?.recentLeads || []).map((lead) => (
                    <div
                      key={lead.id}
                      className="p-2.5 rounded-lg bg-[#0b0518] border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">
                          {lead.alias}
                        </span>{" "}
                        <span className="text-slate-400">({lead.city})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-300">
                          {lead.whatsapp}
                        </span>
                        {lead.isAdult18 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-bold">
                            +18
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#140b29] border border-purple-500/30">
                <h3 className="font-bold text-sm text-amber-300 uppercase mb-3 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" />
                  <span>Historial de Capturas & Cupones QR</span>
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(liveData?.recentClaims || []).length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      Todavía no se reclamaron cupones en esta sesión.
                    </p>
                  ) : (
                    liveData?.recentClaims.map((clm) => (
                      <div
                        key={clm.id}
                        className="p-2.5 rounded-lg bg-[#0b0518] border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-white">
                            {clm.alias} •{" "}
                            <span className="font-mono text-amber-300">
                              {clm.couponCode}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {clm.prizeLabel} ({clm.distanceAtClaimMeters}m)
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            clm.claimType === "MAJOR_PRIZE"
                              ? "bg-amber-400 text-slate-950"
                              : "bg-cyan-900 text-cyan-200"
                          }`}
                        >
                          {clm.claimType === "MAJOR_PRIZE"
                            ? "PREMIO MAYOR"
                            : "CONSUELO"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: AUTOGESTIÓN DE MISIONES (MODO CAMPO + MODO ESCRITORIO)    */}
        {/* ================================================================ */}
        {activeTab === "builder" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Field GPS Button + Link Extractor + Form */}
            <div className="lg:col-span-6 space-y-4">
              {/* MODO CAMPO (CELULAR) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/70 to-[#140b29] border-2 border-emerald-400/60 space-y-3">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase">
                  <Smartphone className="w-4 h-4" />
                  <span>Modo Campo (Celular en la Calle)</span>
                </div>
                <p className="text-xs text-slate-300">
                  Parate exactamente frente al poste, vidriera o mural donde
                  pegás el código QR físico y presioná este botón para clavar la
                  coordenada con GPS de alta precisión:
                </p>
                <button
                  type="button"
                  onClick={() => handleFieldGpsPin(false)}
                  disabled={locatingFieldGps}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-sm uppercase tracking-wide shadow-lg active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  <span>
                    {locatingFieldGps
                      ? "CAPTURANDO SATÉLITES GPS..."
                      : "FIJAR TESORO EN MI UBICACIÓN ACTUAL"}
                  </span>
                </button>
                {gpsAccuracyReport && (
                  <p className="text-xs font-mono text-emerald-200 bg-black/40 p-2 rounded">
                    {gpsAccuracyReport}
                  </p>
                )}
              </div>

              {/* MODO ESCRITORIO: EXTRACTOR GOOGLE MAPS / WHATSAPP */}
              <div className="p-5 rounded-2xl bg-[#140b29] border border-cyan-500/40 space-y-3">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase">
                  <Link2 className="w-4 h-4" />
                  <span>
                    Modo Escritorio: Extraer de Enlace Google Maps / WhatsApp
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Pegá link de Google Maps, ubicación de WhatsApp o -27.3308, -55.8669"
                    value={mapsLinkInput}
                    onChange={(e) => setMapsLinkInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#0b0518] border border-slate-700 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleExtractFromLink}
                    className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs cursor-pointer"
                  >
                    Extraer
                  </button>
                </div>
                {linkExtractFeedback && (
                  <p className="text-xs text-cyan-200 flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 shrink-0" />
                    <span>{linkExtractFeedback}</span>
                  </p>
                )}
              </div>

              {/* EDIT MODE BANNER */}
              {editingMission && (
                <div className="p-4 rounded-xl bg-purple-950/90 border-2 border-purple-400/80 flex items-center justify-between gap-3 text-xs shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <Edit className="w-5 h-5 text-purple-300 shrink-0" />
                    <div>
                      <p className="font-extrabold text-white uppercase tracking-wide">
                        MODO EDICIÓN: {editingMission.title}
                      </p>
                      <p className="text-slate-300 text-[11px]">
                        Reubicá el pin en el mapa interactivo satelital o modificá los textos y presioná guardar.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
                </div>
              )}

              {/* CREATE / EDIT MISSION FORM */}
              <form
                onSubmit={handleSaveMission}
                className="p-5 rf-panel rf-panel-cyan space-y-3.5 shadow-2xl relative overflow-hidden"
              >
                {/* Top-Right Hazard Caution Tab */}
                <div className="absolute top-0 right-0 w-24 h-3 rf-hazard-stripes-cyan border-b border-l border-cyan-500/60" />

                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-base text-white">
                    {editingMission
                      ? `Editar Misión: ${editingMission.title}`
                      : "Configurar Nueva Misión (-1 Crédito)"}
                  </h2>
                  <span className="text-[10px] text-cyan-300 flex items-center gap-1">
                    <BellRing className="w-3.5 h-3.5" />
                    <span>
                      {editingMission
                        ? "Actualiza coordenadas y zona difusa"
                        : "Dispara Web Push automático"}
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase text-cyan-300 mb-1 font-bold">
                      Ciudad de Paraguay
                    </label>
                    <div className="rf-input-slot rf-input-slot-cyan">
                      <select
                        value={city}
                        onChange={(e) => handleCityPresetChange(e.target.value)}
                        className="w-full px-3 py-2 bg-transparent text-sm text-white focus:outline-none cursor-pointer"
                      >
                        {PARAGUAY_CITIES.map((c) => (
                          <option
                            key={c.name}
                            value={c.name}
                            className="bg-[#090e1d]"
                          >
                            {c.name} ({c.department})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase text-cyan-300 mb-1 font-bold">
                      Nodo Físico Reutilizable (Opcional)
                    </label>
                    <div className="rf-input-slot rf-input-slot-cyan">
                      <select
                        value={selectedNodeCode}
                        onChange={(e) => setSelectedNodeCode(e.target.value)}
                        className="w-full px-3 py-2 bg-transparent text-sm text-white focus:outline-none cursor-pointer"
                      >
                        <option value="" className="bg-[#090e1d]">
                          Generar QR Único Nuevo
                        </option>
                        {nodes.map((n) => (
                          <option
                            key={n.id}
                            value={n.code}
                            className="bg-[#090e1d]"
                          >
                            {n.code} — {n.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase text-cyan-300 mb-1 font-bold">
                    Nombre de la Misión
                  </label>
                  <div className="rf-input-slot rf-input-slot-cyan">
                    <input
                      type="text"
                      required
                      placeholder="Ej: Drop Secreto Costanera Viernes"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-transparent text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase text-cyan-300 mb-1 font-bold">
                    Pista Inicial Pública para Cazadores
                  </label>
                  <div className="rf-input-slot rf-input-slot-cyan">
                    <input
                      type="text"
                      placeholder="Ej: Cerca de las letras corpóreas mirando al río..."
                      value={zoneHint}
                      onChange={(e) => setZoneHint(e.target.value)}
                      className="w-full px-3 py-2 bg-transparent text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase text-amber-300 mb-1 font-bold">
                      Premio Mayor (1er Cazador)
                    </label>
                    <div className="rf-input-slot">
                      <input
                        type="text"
                        required
                        placeholder="Ej: Pod 15K + Vale Gs. 300.000"
                        value={prizeTitle}
                        onChange={(e) => setPrizeTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-transparent text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase text-cyan-300 mb-1 font-bold">
                      Pulsos Mínimos (Proof of Hunt)
                    </label>
                    <div className="rf-input-slot rf-input-slot-cyan">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={minPings}
                        onChange={(e) => setMinPings(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-transparent text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase text-slate-300 mb-1 font-bold">
                    Cupón Consuelo (Explorador Curioso / Rezagados)
                  </label>
                  <div className="rf-input-slot">
                    <input
                      type="text"
                      value={consolationTitle}
                      onChange={(e) => setConsolationTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-transparent text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase text-amber-300 mb-1.5 font-bold">
                    Modo de Validación del Ganador
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setValidationMode("HYBRID")}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        validationMode === "HYBRID"
                          ? "bg-purple-950/80 border-cyan-400 text-white shadow-[0_0_12px_rgba(0,240,255,0.25)]"
                          : "bg-[#0b0518] border-slate-700 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-300">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Híbrido (Recomendado)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Llegar al punto exacto o escanear el QR físico.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setValidationMode("PRESENTIAL_GPS")}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        validationMode === "PRESENTIAL_GPS"
                          ? "bg-purple-950/80 border-amber-400 text-white shadow-[0_0_12px_rgba(251,191,36,0.25)]"
                          : "bg-[#0b0518] border-slate-700 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        <span>Encuentro Marketing</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Llegar a &lt;25m para filmar entrega en vivo con equipo
                        de marketing.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setValidationMode("QR_SCAN")}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        validationMode === "QR_SCAN"
                          ? "bg-purple-950/80 border-purple-400 text-white shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                          : "bg-[#0b0518] border-slate-700 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-purple-300">
                        <QrCode className="w-3.5 h-3.5 text-purple-400" />
                        <span>Código QR Oculto</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Encontrar y escanear sticker físico con cámara.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs bg-[#050813] p-3 rounded border border-cyan-500/30">
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      LATITUD SECRETA
                    </span>
                    <span className="text-amber-300 font-bold">{pinLat}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      LONGITUD SECRETA
                    </span>
                    <span className="text-amber-300 font-bold">{pinLng}</span>
                  </div>
                </div>

                {builderFeedback && (
                  <div className="p-3 rounded bg-purple-950/80 border border-purple-400 text-xs text-white">
                    {builderFeedback}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingMission}
                  className={`w-full py-3 ${
                    editingMission ? "rf-btn-cyan" : "rf-btn-gold"
                  } text-sm tracking-widest flex items-center justify-center gap-2`}
                >
                  <Rocket className="w-4 h-4" />
                  <span>
                    {savingMission
                      ? "GUARDANDO CAMBIOS..."
                      : editingMission
                      ? "GUARDAR CAMBIOS DE LA MISIÓN"
                      : "PUBLICAR Y ACTIVAR MISIÓN EN MAPA NACIONAL"}
                  </span>
                </button>
              </form>
            </div>

            {/* Right Column: Interactive Desktop National Map */}
            <div className="lg:col-span-6 rounded-2xl overflow-hidden border-2 border-cyan-400/50 bg-[#140b29] flex flex-col min-h-[540px]">
              <div className="p-3 bg-[#0e0720] border-b border-purple-500/30 flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Crosshair className="w-4 h-4" />
                  <span>
                    Mapa Interactivo Nacional: Hacé clic o arrastrá el marcador
                  </span>
                </span>
                <span className="font-mono text-amber-300">
                  {pinLat.toFixed(5)}, {pinLng.toFixed(5)}
                </span>
              </div>
              <div className="flex-1 relative">
                <ArcadeMap
                  centerLat={pinLat}
                  centerLng={pinLng}
                  zoom={15.5}
                  primaryColor={brand.primaryColor}
                  secondaryColor={brand.secondaryColor}
                  mode="admin-pin"
                  showHeatmap={showHeatmap}
                  heatmapPoints={heatmapPoints}
                  secretPin={{ lat: pinLat, lng: pinLng }}
                  onSelectCoord={(lat, lng) => {
                    setPinLat(lat);
                    setPinLng(lng);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 3: PRINTABLE PHYSICAL QR CODES & SOCIAL COPY GENERATOR       */}
        {/* ================================================================ */}
        {activeTab === "qrs" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {missions.map((m) => {
              const codeToUse = m.nodeCode || m.qrToken;
              const claimUrl = `${originUrl}/b/${brand.slug}/claim?token=${encodeURIComponent(
                codeToUse
              )}`;
              const qrImgSrc = `/api/qr?data=${encodeURIComponent(claimUrl)}`;
              const isCopied = copiedMissionId === m.id;

              return (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl bg-[#140b29] border border-purple-500/40 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded bg-purple-900 text-cyan-300 text-[10px] font-bold uppercase">
                        {m.city}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          m.status === "ACTIVE"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                            : m.status === "CAPTURED"
                            ? "bg-amber-400 text-slate-950"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-base text-white">
                      {m.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Premio: {m.prizeTitle}
                    </p>
                  </div>

                  {/* Printable QR Box */}
                  <div className="p-4 rounded-xl bg-white text-slate-950 text-center space-y-2">
                    <p className="font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5">
                      <BrandIconSvg
                        iconKey={brand.logoEmoji}
                        className="w-4 h-4 text-purple-700"
                      />
                      <span>{brand.name} • ESCANEAME</span>
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrImgSrc}
                      alt={`QR ${m.title}`}
                      className="w-44 h-44 mx-auto"
                    />
                    <p className="font-mono text-xs font-bold bg-slate-100 py-1 rounded">
                      NODO: {codeToUse}
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Social / WhatsApp Ad Copy Generator Button */}
                    <button
                      type="button"
                      onClick={() => handleCopySocialAd(m)}
                      className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:opacity-95 text-white font-extrabold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      {isCopied ? (
                        <Check className="w-4 h-4 shrink-0" />
                      ) : (
                        <Megaphone className="w-4 h-4 shrink-0" />
                      )}
                      <span>
                        {isCopied
                          ? "ANUNCIO COPIADO"
                          : "GENERAR ANUNCIO PARA WHATSAPP / INSTAGRAM"}
                      </span>
                    </button>

                    {m.status === "CAPTURED" && (
                      <div className="p-2 rounded bg-amber-950/60 border border-amber-400/50 text-amber-200 flex items-center justify-between">
                        <span>Ganador: {m.winnerAlias}</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleMissionStatus(m, "ACTIVE", true)
                          }
                          className="px-2 py-1 rounded bg-amber-400 text-slate-950 font-bold text-[10px] cursor-pointer"
                        >
                          Reactivar Misión
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <a
                        href={qrImgSrc}
                        download={`QR-${brand.slug}-${codeToUse}.svg`}
                        className="flex-1 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-center text-xs flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>QR SVG</span>
                      </a>
                      {m.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => handleToggleMissionStatus(m, "PAUSED")}
                          className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer text-xs"
                        >
                          Pausar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleMissionStatus(m, "ACTIVE")}
                          className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer flex items-center gap-1 text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Activar</span>
                        </button>
                      )}
                    </div>

                    {/* Botones de Edición de Ubicación y Eliminación */}
                    <div className="flex gap-2 pt-2 border-t border-purple-500/20">
                      <button
                        type="button"
                        onClick={() => handleStartEditMission(m)}
                        className="flex-1 py-2 px-3 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-200 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                      >
                        <Edit className="w-3.5 h-3.5 shrink-0 text-cyan-300" />
                        <span>Editar Misión</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingMission(m)}
                        className="py-2 px-3 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                        title="Eliminar este drop permanentemente"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0 text-red-400" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================================================================ */}
        {/* MODAL RETROFUTURISTA: CONFIRMAR ELIMINACIÓN DE DROP              */}
        {/* ================================================================ */}
        {deletingMission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="rf-panel rf-panel-crimson max-w-md w-full p-6 space-y-4 shadow-2xl relative border-2 border-red-500">
              <div className="flex items-center gap-2 text-red-400 font-black text-sm uppercase tracking-wider">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>CONFIRMAR ELIMINACIÓN DE DROP</span>
              </div>

              <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <p>
                  ¿Estás seguro de que deseás eliminar permanentemente la misión{" "}
                  <strong className="text-white">"{deletingMission.title}"</strong> en{" "}
                  <strong className="text-cyan-300">{deletingMission.city}</strong>?
                </p>
                <p className="text-slate-400">
                  Esta acción es irreversible y eliminará todos los pings de rastreo y telemetría asociados.
                </p>
              </div>

              {!deletingMission.winnerHunterId && deletingMission.status !== "CAPTURED" ? (
                <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-400/50 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>
                    Drop no capturado: Al eliminarlo se reembolsará{" "}
                    <strong>+1 crédito de drop</strong> a tu cuenta de comercio.
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-400/50 text-amber-300 text-xs">
                  Aviso: Este drop ya fue capturado por{" "}
                  <strong className="text-white">{deletingMission.winnerAlias || "un cazador"}</strong>.
                  Se eliminarán los registros históricos del mapa.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingMission(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteMission}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs uppercase cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>{isDeleting ? "ELIMINANDO..." : "SÍ, ELIMINAR"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
