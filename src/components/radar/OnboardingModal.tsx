"use client";

import { useState } from "react";
import { ShieldCheck, Zap } from "lucide-react";
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
      arcadeHardware.requestWakeLock();
      onComplete(data.hunter, data.sessionToken);
    } catch {
      setError("Error de conexión con el servidor Radar Quest.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-[#0b0518]/88 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-xl p-5 border-2 shadow-2xl relative overflow-hidden"
        style={{
          backgroundColor: "#140b29",
          borderColor: brand.primaryColor,
          boxShadow: `0 0 32px ${brand.primaryColor}44`,
        }}
      >
        <div className="text-center mb-4">
          <div
            className="w-12 h-12 rounded-xl border-2 flex items-center justify-center mx-auto mb-2 text-cyan-300"
            style={{
              borderColor: brand.primaryColor,
              backgroundColor: `${brand.primaryColor}22`,
            }}
          >
            <BrandIconSvg iconKey={brand.logoEmoji} className="w-6 h-6" />
          </div>
          <p
            className="font-pixel text-[10px] uppercase tracking-widest mb-1"
            style={{ color: brand.secondaryColor }}
          >
            INSERT COIN • REGISTRO EN 3 SEG
          </p>
          <h2 className="text-xl font-extrabold text-white">{brand.name}</h2>
          <p className="text-xs text-slate-300 mt-0.5">{brand.tagline}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] uppercase font-bold text-slate-300 mb-1">
              Alias o @Instagram
            </label>
            <input
              type="text"
              required
              placeholder="@tu_usuario"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              className="w-full px-3 py-2.5 rounded bg-[#0c061a] border border-purple-500/50 text-white text-sm focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase font-bold text-slate-300 mb-1">
              WhatsApp (Para validar tu Premio)
            </label>
            <input
              type="tel"
              required
              placeholder="0981 555 420"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full px-3 py-2.5 rounded bg-[#0c061a] border border-purple-500/50 text-white text-sm focus:outline-none focus:border-cyan-400"
            />
          </div>

          {brand.requireAdult18 && (
            <label className="flex items-start gap-2.5 p-2.5 rounded bg-purple-950/50 border border-purple-500/40 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAdult18}
                onChange={(e) => setIsAdult18(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-purple-500"
              />
              <span className="text-xs text-slate-200 leading-snug">
                <strong className="text-amber-300">+18 OBLIGATORIO:</strong>{" "}
                Declaro ser mayor de 18 años y acepto recibir mi cupón oficial de{" "}
                {brand.name}.
              </span>
            </label>
          )}

          {error && (
            <div className="p-2.5 rounded bg-red-950/80 border border-red-500 text-red-200 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-extrabold text-sm uppercase tracking-wider text-slate-950 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
            style={{
              background: `linear-gradient(90deg, ${brand.secondaryColor}, ${brand.primaryColor})`,
            }}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>{loading ? "CONECTANDO RADAR..." : "ACTIVAR RADAR TÉRMICO"}</span>
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sesión protegida con firma HMAC-SHA256 • GPS Anti-Cheat</span>
          </div>
        </form>
      </div>
    </div>
  );
}

