"use client";

import { useState } from "react";
import { AtSign, ShieldCheck, Smartphone, Zap } from "lucide-react";
import type { Brand, Hunter, PublicBrand } from "@/types/radar";
import { BrandIconSvg } from "@/components/icons/BrandIconSvg";
import { arcadeHardware } from "@/lib/hardware/arcadeHardware";

interface OnboardingModalProps {
  brand: Brand | PublicBrand;
  sourceMissionId: string | null;
  onComplete: (hunter: Hunter, sessionToken: string) => void;
}

export function OnboardingModal({
  brand,
  sourceMissionId,
  onComplete,
}: OnboardingModalProps) {
  const [alias, setAlias] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isAdult18, setIsAdult18] = useState(!brand.requireAdult18);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias,
          whatsapp,
          isAdult18: brand.requireAdult18 ? isAdult18 : true,
          brandSlug: brand.slug,
          sourceMissionId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "Revisá tus datos para iniciar.");
        setLoading(false);
        return;
      }

      // Persist in localStorage alongside server-set HMAC-SHA256 cookie
      try {
        localStorage.setItem(
          "rq_hunter_profile",
          JSON.stringify({
            hunter: data.hunter,
            sessionToken: data.sessionToken,
          })
        );
      } catch {}

      arcadeHardware.playPowerUpOnboarding();
      arcadeHardware.playBgm();
      arcadeHardware.requestWakeLock();
      onComplete(data.hunter, data.sessionToken);
    } catch {
      setError("Error de conexión con el servidor Radar Quest.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-[#05020c]/90 backdrop-blur-md animate-in fade-in duration-200">
      {/* RETROFUTURISTIC CHASSIS (Based on reference UI Kit) */}
      <div className="w-full max-w-sm rf-panel rf-panel-gold p-5 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.95)]">
        {/* 4 Corner Rivet Screws */}
        <div className="rf-screw rf-screw-tl" />
        <div className="rf-screw rf-screw-tr" />
        <div className="rf-screw rf-screw-bl" />
        <div className="rf-screw rf-screw-br" />

        {/* Top-Right Hazard Warning Caution Tab */}
        <div className="absolute top-0 right-0 w-24 h-3 rf-hazard-stripes border-b border-l border-amber-600/70" />

        {/* Top Riveted "SIGN IN" Plate (Inspired by reference UI Kit) */}
        <div className="flex justify-center -mt-2 mb-3">
          <div className="px-4 py-1 rounded-sm rf-tab-won text-xs flex items-center gap-1.5 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-950 animate-pulse" />
            <span>SIGN IN • REGISTRO EN 3 SEG</span>
          </div>
        </div>

        <div className="text-center mb-4">
          <div
            className="w-12 h-12 rounded-lg border-2 flex items-center justify-center mx-auto mb-2 text-cyan-300 shadow-md"
            style={{
              borderColor: brand.primaryColor,
              backgroundColor: `${brand.primaryColor}22`,
            }}
          >
            <BrandIconSvg iconKey={brand.logoEmoji} className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-wide">
            {brand.name}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">{brand.tagline}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* RETROFUTURISTIC TEXT BOX 1: ALIAS (Inspired by "ENTER LAND #") */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-amber-300 tracking-wider mb-1">
              Alias o @Instagram
            </label>
            <div className="rf-input-slot">
              <div className="px-2.5 py-2 border-r border-slate-700 bg-slate-900/80 text-amber-400 flex items-center justify-center">
                <AtSign className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                required
                placeholder="@tu_usuario"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="w-full px-2.5 py-2 bg-transparent text-white font-mono text-xs uppercase tracking-wide focus:outline-none"
              />
            </div>
          </div>

          {/* RETROFUTURISTIC TEXT BOX 2: WHATSAPP */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-amber-300 tracking-wider mb-1">
              WhatsApp (Para validar tu Premio)
            </label>
            <div className="rf-input-slot">
              <div className="px-2.5 py-2 border-r border-slate-700 bg-slate-900/80 text-amber-400 flex items-center justify-center">
                <Smartphone className="w-3.5 h-3.5" />
              </div>
              <input
                type="tel"
                required
                placeholder="0981 555 420"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full px-2.5 py-2 bg-transparent text-white font-mono text-xs uppercase tracking-wide focus:outline-none"
              />
            </div>
          </div>

          {brand.requireAdult18 && (
            <label className="flex items-start gap-2.5 p-2 rounded bg-[#050813] border border-amber-600/50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAdult18}
                onChange={(e) => setIsAdult18(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-200 leading-snug">
                <strong className="text-amber-300">+18 OBLIGATORIO:</strong>{" "}
                Declaro ser mayor de 18 años y acepto recibir mi cupón oficial de{" "}
                {brand.name}.
              </span>
            </label>
          )}

          {error && (
            <div className="p-2.5 rounded bg-red-950/90 border border-red-500 text-red-200 text-xs">
              {error}
            </div>
          )}

          {/* RETROFUTURISTIC 3D MECHANICAL BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rf-btn-gold text-sm tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>
              {loading ? "CONECTANDO RADAR..." : "ACTIVAR RADAR TÉRMICO"}
            </span>
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sesión protegida con firma HMAC-SHA256 • Anti-Cheat</span>
          </div>
        </form>
      </div>
    </div>
  );
}

