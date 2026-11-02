"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Coins,
  Database,
  ExternalLink,
  KeyRound,
  Layers,
  LogOut,
  Plus,
  QrCode,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PARAGUAY_CITIES } from "@/lib/radar/geo";
import {
  BRAND_ICON_OPTIONS,
  BrandIconSvg,
} from "@/components/icons/BrandIconSvg";
import type {
  Brand,
  CreditTransaction,
  ReusableQrNode,
} from "@/types/radar";

interface EnrichedBrand extends Brand {
  missionsCount: number;
  leadsCount: number;
  nodesCount: number;
}

interface SuperAdminSnapshot {
  ok: boolean;
  storageEngine: string;
  studio: string;
  metrics: {
    totalBrands: number;
    activeBrands: number;
    totalMissions: number;
    activeMissions: number;
    capturedMissions: number;
    totalLeads: number;
    activeHuntersOnline: number;
    totalAnomaliesBlocked: number;
    totalReusableNodes: number;
  };
  brands: EnrichedBrand[];
  reusableNodes: ReusableQrNode[];
  creditLedger: CreditTransaction[];
}

export function SuperAdminClient() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<SuperAdminSnapshot | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Brand Form (includes 6-digit adminPin)
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoEmoji, setLogoEmoji] = useState("bolt");
  const [primaryColor, setPrimaryColor] = useState("#a855f7");
  const [secondaryColor, setSecondaryColor] = useState("#00f0ff");
  const [whatsapp, setWhatsapp] = useState("+595981");
  const [adminPin, setAdminPin] = useState("246810");
  const [requireAdult18, setRequireAdult18] = useState(true);
  const [cityDefault, setCityDefault] = useState("Encarnación");
  const [missionCredits, setMissionCredits] = useState(10);

  // PIN Edit Map
  const [pinDrafts, setPinDrafts] = useState<Record<string, string>>({});

  // New Reusable Node Form
  const [nodeBrandId, setNodeBrandId] = useState("");
  const [nodeCode, setNodeCode] = useState("");
  const [nodeLabel, setNodeLabel] = useState("");

  const loadSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/super", { cache: "no-store" });
      if (res.status === 401) {
        router.refresh();
        return;
      }
      const data = (await res.json()) as SuperAdminSnapshot;
      if (data.ok) {
        setSnapshot(data);
        if (!nodeBrandId && data.brands[0]) {
          setNodeBrandId(data.brands[0].id);
        }
      }
    } catch {}
  }, [nodeBrandId, router]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const handleLogout = async () => {
    await fetch("/api/auth/super-admin", { method: "DELETE" });
    router.refresh();
  };

  const handleRecharge = async (brandId: string, delta: number) => {
    await fetch("/api/admin/super", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "RECHARGE_CREDITS",
        brandId,
        delta,
        reason: `Recarga comercial (+${delta} créditos) desde CeroUno Studio`,
      }),
    });
    loadSnapshot();
  };

  const handleUpdatePin = async (brandId: string) => {
    const candidate = (pinDrafts[brandId] || "").trim();
    if (!/^\d{6}$/.test(candidate)) {
      setFeedback("El nuevo PIN debe tener exactamente 6 dígitos numéricos.");
      return;
    }
    const res = await fetch("/api/admin/super", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_PIN",
        brandId,
        adminPin: candidate,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setFeedback(`PIN de ${data.brand.name} actualizado a ${candidate}.`);
      setPinDrafts((prev) => ({ ...prev, [brandId]: "" }));
      loadSnapshot();
    }
  };

  const handleToggleBrand = async (brandId: string) => {
    await fetch("/api/admin/super", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "TOGGLE_BRAND",
        brandId,
      }),
    });
    loadSnapshot();
  };

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await fetch("/api/admin/super", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_BRAND",
        name,
        slug,
        logoEmoji,
        primaryColor,
        secondaryColor,
        whatsapp,
        adminPin,
        requireAdult18,
        cityDefault,
        missionCredits,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      setFeedback(data.message);
      return;
    }
    setName("");
    setSlug("");
    setFeedback(
      `Cliente "${data.brand.name}" creado en /b/${data.brand.slug} (Admin PIN: ${data.brand.adminPin})`
    );
    loadSnapshot();
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await fetch("/api/admin/super", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_NODE",
        brandId: nodeBrandId,
        code: nodeCode,
        label: nodeLabel,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      setFeedback(data.message);
      return;
    }
    setNodeCode("");
    setNodeLabel("");
    setFeedback(`Nodo físico reutilizable ${data.node.code} provisionado.`);
    loadSnapshot();
  };

  return (
    <div className="min-h-screen bg-[#090414] text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* SUPER-ADMIN HEADER */}
        <header className="p-6 rounded-2xl bg-gradient-to-r from-[#170b30] via-[#140b29] to-[#0f172a] border-2 border-purple-500/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl">
          <div>
            <p className="font-pixel text-[10px] text-cyan-300 uppercase mb-1">
              CEROUNO STUDIO • INFRAESTRUCTURA MULTI-TENANT NACIONAL
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2.5">
              <Sparkles className="w-7 h-7 text-amber-300" />
              <span>Radar Quest SaaS • Super-Admin</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Motor de Datos: {snapshot?.storageEngine || "Cargando..."}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/b/el-vape-club"
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Radar El Vape Club</span>
            </Link>
            <Link
              href="/"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs"
            >
              Inicio Portal
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </header>

        {feedback && (
          <div className="p-3.5 rounded-xl bg-purple-950/90 border border-cyan-400 text-xs text-cyan-100 font-semibold">
            {feedback}
          </div>
        )}

        {/* GLOBAL INFRASTRUCTURE METRICS */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="p-4 rounded-xl bg-[#140b29] border border-purple-500/40">
            <p className="text-[11px] uppercase text-slate-400">
              Marcas Activas
            </p>
            <p className="text-2xl font-extrabold text-white mt-1">
              {snapshot?.metrics.activeBrands ?? 0} /{" "}
              {snapshot?.metrics.totalBrands ?? 0}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#140b29] border border-cyan-500/40">
            <p className="text-[11px] uppercase text-slate-400">
              Misiones Activas PY
            </p>
            <p className="text-2xl font-extrabold text-cyan-300 mt-1">
              {snapshot?.metrics.activeMissions ?? 0}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#140b29] border border-emerald-500/40">
            <p className="text-[11px] uppercase text-slate-400">
              Total Leads WhatsApp
            </p>
            <p className="text-2xl font-extrabold text-emerald-300 mt-1">
              {snapshot?.metrics.totalLeads ?? 0}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#140b29] border border-amber-500/40">
            <p className="text-[11px] uppercase text-slate-400">
              Nodos QR Físicos
            </p>
            <p className="text-2xl font-extrabold text-amber-300 mt-1">
              {snapshot?.metrics.totalReusableNodes ?? 0}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#140b29] border border-pink-500/40 col-span-2 md:col-span-1">
            <p className="text-[11px] uppercase text-slate-400">
              Anti-Spoofing Blocks
            </p>
            <p className="text-2xl font-extrabold text-pink-400 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5" />
              <span>{snapshot?.metrics.totalAnomaliesBlocked ?? 0}</span>
            </p>
          </div>
        </section>

        {/* TENANT BRANDS CARDS */}
        <section className="space-y-3">
          <h2 className="font-bold text-base uppercase tracking-wider text-cyan-300 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <span>Clientes White-Label, Créditos & PIN de Acceso (6 Dígitos)</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(snapshot?.brands || []).map((b) => (
              <div
                key={b.id}
                className="p-5 rounded-2xl bg-[#140b29] border-2 flex flex-col justify-between gap-4"
                style={{
                  borderColor: b.active ? b.primaryColor : "#334155",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl border flex items-center justify-center text-cyan-300 shrink-0"
                      style={{
                        borderColor: b.primaryColor,
                        backgroundColor: `${b.primaryColor}20`,
                      }}
                    >
                      <BrandIconSvg iconKey={b.logoEmoji} className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-lg text-white">
                          {b.name}
                        </h3>
                        {b.requireAdult18 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                            +18
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-cyan-300">
                        /b/{b.slug} • PIN actual:{" "}
                        <strong className="text-amber-300">{b.adminPin}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase text-slate-400 block">
                      Créditos
                    </span>
                    <span className="font-mono text-2xl font-extrabold text-emerald-300">
                      {b.missionCredits}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs bg-[#0b0518] p-2.5 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Misiones
                    </span>
                    <strong className="text-white">{b.missionsCount}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Leads CRM
                    </span>
                    <strong className="text-emerald-300">{b.leadsCount}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Nodos QR
                    </span>
                    <strong className="text-amber-300">{b.nodesCount}</strong>
                  </div>
                </div>

                {/* Quick 6-digit PIN Rotation */}
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-300 shrink-0" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Nuevo PIN 6 dígitos"
                    value={pinDrafts[b.id] || ""}
                    onChange={(e) =>
                      setPinDrafts((prev) => ({
                        ...prev,
                        [b.id]: e.target.value.replace(/\D/g, "").slice(0, 6),
                      }))
                    }
                    className="flex-1 px-2.5 py-1.5 rounded bg-[#0b0518] border border-slate-700 font-mono text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdatePin(b.id)}
                    className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold cursor-pointer"
                  >
                    Cambiar PIN
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRecharge(b.id, 5)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>+5 Créd</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRecharge(b.id, 15)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-bold text-xs cursor-pointer"
                    >
                      +15 Créd
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleBrand(b.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                    >
                      {b.active ? "Pausar" : "Activar"}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/b/${b.slug}/admin`}
                      className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center gap-1"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>/b/{b.slug}/admin</span>
                    </Link>
                    <Link
                      href={`/b/${b.slug}`}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                    >
                      Jugar
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CREATE NEW BRAND + PROVISION REUSABLE QR NODE */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateBrand}
            className="lg:col-span-7 p-5 rounded-2xl bg-[#140b29] border border-purple-500/40 space-y-3.5"
          >
            <h3 className="font-bold text-sm uppercase tracking-wider text-purple-300 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Dar de Alta Nueva Marca White-Label</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] uppercase text-slate-400 mb-1">
                  Nombre Comercial
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Neon Drinks CDE"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "")
                    );
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0518] border border-slate-700 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase text-slate-400 mb-1">
                  PIN Admin (6 dígitos)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={adminPin}
                  onChange={(e) =>
                    setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0518] border border-amber-400/50 font-mono text-sm text-amber-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] uppercase text-slate-400 mb-1">
                  Slug Ruta (/b/[slug])
                </label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0518] border border-slate-700 font-mono text-xs text-cyan-300"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase text-slate-400 mb-1">
                  WhatsApp Canjes
                </label>
                <input
                  type="text"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0518] border border-slate-700 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase text-slate-400 mb-1">
                  Ciudad Base
                </label>
                <select
                  value={cityDefault}
                  onChange={(e) => setCityDefault(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0518] border border-slate-700 text-sm text-white"
                >
                  {PARAGUAY_CITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] uppercase text-slate-400 mb-1">
                  Icono SVG
                </label>
                <select
                  value={logoEmoji}
                  onChange={(e) => setLogoEmoji(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#0b0518] border border-slate-700 text-xs text-white"
                >
                  {BRAND_ICON_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase text-slate-400 mb-1">
                  Primario
                </label>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-full h-9 rounded bg-[#0b0518] border border-slate-700 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase text-slate-400 mb-1">
                  Secundario
                </label>
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-full h-9 rounded bg-[#0b0518] border border-slate-700 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase text-slate-400 mb-1">
                  Créditos
                </label>
                <input
                  type="number"
                  min={1}
                  value={missionCredits}
                  onChange={(e) => setMissionCredits(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0b0518] border border-slate-700 text-sm text-white"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={requireAdult18}
                onChange={(e) => setRequireAdult18(e.target.checked)}
                className="w-4 h-4 accent-purple-500"
              />
              <span>Activar Restricción Obligatoria +18 en Onboarding</span>
            </label>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer"
            >
              Crear Instancia Multimarca
            </button>
          </form>

          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleCreateNode}
              className="p-5 rounded-2xl bg-[#140b29] border border-amber-500/40 space-y-3"
            >
              <h3 className="font-bold text-sm uppercase tracking-wider text-amber-300 flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                <span>Provisionar Nodo QR Físico Reutilizable</span>
              </h3>

              <select
                value={nodeBrandId}
                onChange={(e) => setNodeBrandId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0b0518] border border-slate-700 text-xs text-white"
              >
                {(snapshot?.brands || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    Asignar a: {b.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Código ej: RQ-NODE-CDE-01 (vacío = auto)"
                value={nodeCode}
                onChange={(e) => setNodeCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0b0518] border border-slate-700 font-mono text-xs text-amber-300 uppercase"
              />

              <input
                type="text"
                required
                placeholder="Etiqueta ej: Sticker Acrílico #03 Centro"
                value={nodeLabel}
                onChange={(e) => setNodeLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0b0518] border border-slate-700 text-xs text-white"
              />

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs uppercase cursor-pointer"
              >
                Generar Nodo Reutilizable
              </button>
            </form>

            <div className="p-5 rounded-2xl bg-[#140b29] border border-slate-800 space-y-2.5">
              <h3 className="font-bold text-xs uppercase text-slate-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Auditoría de Créditos de Misión</span>
              </h3>
              <div className="max-h-44 overflow-y-auto space-y-1.5 text-xs">
                {(snapshot?.creditLedger || []).map((tx) => (
                  <div
                    key={tx.id}
                    className="p-2 rounded bg-[#0b0518] flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-300 truncate">{tx.reason}</span>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        tx.delta > 0 ? "text-emerald-400" : "text-amber-300"
                      }`}
                    >
                      {tx.delta > 0 ? `+${tx.delta}` : tx.delta}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

