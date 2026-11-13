"use client";

import { useState } from "react";
import { Award, CheckCircle2, ExternalLink, MapPin, QrCode, X } from "lucide-react";
import type { Brand, Hunter, PublicBrand, RadarClaimResponse } from "@/types/radar";
import { arcadeHardware } from "@/lib/hardware/arcadeHardware";

interface QrClaimModalProps {
  brand: Brand | PublicBrand;
  hunter: Hunter;
  sessionToken: string;
  currentCoords: { lat: number; lng: number; accuracy: number } | null;
  suggestedCode?: string;
  initialResult?: RadarClaimResponse | null;
  onClose: () => void;
  onClaimSuccess?: (res: RadarClaimResponse) => void;
}

export function QrClaimModal({
  brand,
  hunter,
  sessionToken,
  currentCoords,
  suggestedCode = "",
  initialResult = null,
  onClose,
  onClaimSuccess,
}: QrClaimModalProps) {
  const [tokenInput, setTokenInput] = useState(suggestedCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RadarClaimResponse | null>(initialResult);

  const handleValidateQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      let coords = currentCoords;
      if (!coords && typeof navigator !== "undefined" && navigator.geolocation) {
        coords = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy || 10,
              }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 6000 }
          );
        });
      }

      if (!coords) {
        setResult({
          ok: false,
          message:
            "No pudimos leer tu GPS actual. Activá la ubicación o usá el Simulador Demo en PC.",
        });
        setLoading(false);
        return;
      }

      const res = await fetch("/api/radar/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenOrNodeCode: tokenInput.trim(),
          brandSlug: brand.slug,
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy,
          hunterId: hunter.id,
          alias: hunter.alias,
          sessionToken,
        }),
      });

      const data = (await res.json()) as RadarClaimResponse;
      setResult(data);

      if (data.ok) {
        arcadeHardware.playVictoryFanfare();
        onClaimSuccess?.(data);
      }
    } catch {
      setResult({
        ok: false,
        message: "Error de red al verificar el QR físico.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* RETROFUTURISTIC CHASSIS */}
      <div className="w-full max-w-sm rf-panel rf-panel-cyan p-5 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.95)]">
        {/* 4 Corner Rivet Screws */}
        <div className="rf-screw rf-screw-tl" />
        <div className="rf-screw rf-screw-tr" />
        <div className="rf-screw rf-screw-bl" />
        <div className="rf-screw rf-screw-br" />

        {/* Top-Right Hazard Warning Caution Tab */}
        <div className="absolute top-0 right-0 w-24 h-3 rf-hazard-stripes-cyan border-b border-l border-cyan-500/60" />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rf-btn-steel text-xs z-10"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {!result?.ok ? (
          <>
            {/* Top Riveted Nameplate */}
            <div className="flex justify-center -mt-2 mb-3">
              <div className="rf-nameplate text-cyan-300 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>NODO DE CANJE • DOBLE VALIDACIÓN</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="p-2.5 rounded-lg border border-cyan-400/50 bg-[#061226] text-cyan-300"
              >
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <p className="font-pixel text-[9px] text-amber-300 uppercase">
                  VERIFICACIÓN ATÓMICA
                </p>
                <h3 className="font-bold text-base text-white">
                  Capturar Nodo Físico
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Al escanear el cartel QR en la calle se valida automáticamente.
              También podés ingresar el código del Nodo Reutilizable:
            </p>

            <form onSubmit={handleValidateQr} className="space-y-3">
              {/* RETROFUTURISTIC TEXT BOX (ENTER LAND # style) */}
              <div className="rf-input-slot rf-input-slot-cyan">
                <div className="px-2.5 py-2 border-r border-slate-700 bg-slate-900/80 text-cyan-400 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ej: RQ-NODE-ENC-01"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full px-2.5 py-2 bg-transparent text-cyan-200 font-mono text-xs uppercase tracking-wide focus:outline-none"
                />
              </div>

              {result && !result.ok && (
                <div className="p-2.5 rounded bg-red-950/90 border border-red-500 text-xs text-red-200">
                  {result.message}
                </div>
              )}

              {/* RETROFUTURISTIC 3D MECHANICAL BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rf-btn-cyan text-xs tracking-wider disabled:opacity-50"
              >
                {loading
                  ? "VERIFICANDO HAVERSINE..."
                  : "VALIDAR CAPTURA EN SERVIDOR"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-3 py-1">
            {/* Top Victory Tab ("YOU WON" style from reference image) */}
            <div className="flex justify-center -mt-1 mb-2">
              <div
                className={`px-5 py-1.5 rounded-sm text-sm flex items-center justify-center gap-2 ${
                  result.claim?.claimType === "MAJOR_PRIZE"
                    ? "rf-tab-won"
                    : "rf-tab-cyan"
                }`}
              >
                <Award className="w-4 h-4 shrink-0 text-amber-950" />
                <span>
                  {result.claim?.claimType === "MAJOR_PRIZE"
                    ? "¡YOU WON! PREMIO MAYOR"
                    : "CUPÓN EXPLORADOR CURIOSO"}
                </span>
              </div>
            </div>

            {/* "REWARDS :" Label (From reference UI kit) */}
            <div className="flex justify-center my-1">
              <div className="rf-rewards-banner text-xs">
                <span>REWARDS :</span>
              </div>
            </div>

            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-400/15 border-2 border-amber-300 text-amber-300 mx-auto shadow-[0_0_20px_rgba(251,191,36,0.3)]">
              {result.claim?.claimType === "MAJOR_PRIZE" ? (
                <Award className="w-8 h-8" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-cyan-300" />
              )}
            </div>

            <p className="text-xs text-slate-200 leading-relaxed font-semibold">
              {result.message}
            </p>

            {result.claim?.claimMethod === "PRESENTIAL_GPS" && (
              <div className="p-3 rounded bg-emerald-950/80 border border-emerald-400/70 text-emerald-200 text-xs space-y-1 text-left">
                <p className="font-bold flex items-center gap-1.5 text-emerald-300">
                  <MapPin className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Equipo de Marketing en el Lugar:</span>
                </p>
                <p className="text-[11px] text-emerald-100 leading-normal">
                  ¡Mostrale esta pantalla o tu código de canje al equipo de{" "}
                  {brand.name} para filmar la entrega oficial y recibir tu
                  premio en mano!
                </p>
              </div>
            )}

            {result.claim && (
              <div className="p-3 rounded-lg bg-[#050813] border-2 border-amber-400/60 space-y-1 shadow-inner">
                <p className="text-[10px] uppercase text-slate-400 tracking-wider">
                  Código Único de Canje
                </p>
                <p className="font-mono text-lg font-black text-amber-300 tracking-widest">
                  {result.claim.couponCode}
                </p>
                <p className="text-xs font-semibold text-cyan-300">
                  {result.claim.prizeLabel}
                </p>
                <p className="text-[10px] text-slate-400">
                  Distancia GPS: {result.claim.distanceAtClaimMeters}m (Radio máx{" "}
                  {result.claim.effectiveRadiusMeters}m)
                </p>
              </div>
            )}

            {result.claim?.whatsappRedeemUrl && (
              <a
                href={result.claim.whatsappRedeemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rf-btn-emerald text-xs tracking-wider flex items-center justify-center gap-2"
              >
                <span>RECLAMAR EN WHATSAPP DE {brand.name}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

