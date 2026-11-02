"use client";

import { useState } from "react";
import { Award, CheckCircle2, ExternalLink, QrCode, X } from "lucide-react";
import type { Brand, Hunter, PublicBrand, RadarClaimResponse } from "@/types/radar";
import { arcadeHardware } from "@/lib/hardware/arcadeHardware";

interface QrClaimModalProps {
  brand: Brand | PublicBrand;
  hunter: Hunter;
  sessionToken: string;
  currentCoords: { lat: number; lng: number; accuracy: number } | null;
  suggestedCode?: string;
  onClose: () => void;
  onClaimSuccess?: (res: RadarClaimResponse) => void;
}

export function QrClaimModal({
  brand,
  hunter,
  sessionToken,
  currentCoords,
  suggestedCode = "",
  onClose,
  onClaimSuccess,
}: QrClaimModalProps) {
  const [tokenInput, setTokenInput] = useState(suggestedCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RadarClaimResponse | null>(null);

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
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-xl p-5 border-2 relative bg-[#140b29] text-white shadow-2xl"
        style={{ borderColor: brand.secondaryColor }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded bg-slate-800/80 text-slate-300 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {!result?.ok ? (
          <>
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${brand.primaryColor}33` }}
              >
                <QrCode
                  className="w-6 h-6"
                  style={{ color: brand.secondaryColor }}
                />
              </div>
              <div>
                <p className="font-pixel text-[9px] text-cyan-300 uppercase">
                  DOBLE VALIDACIÓN GPS + QR
                </p>
                <h3 className="font-bold text-base">Capturar Nodo QR Físico</h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Al escanear el cartel QR en la calle con tu cámara se valida
              automáticamente. También podés ingresar el código del Nodo
              Reutilizable impreso bajo el QR:
            </p>

            <form onSubmit={handleValidateQr} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Ej: RQ-NODE-ENC-01 o EVC-ENC-..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full px-3 py-2.5 rounded bg-[#0a0516] border border-cyan-400/50 text-cyan-200 font-mono text-sm uppercase focus:outline-none focus:border-cyan-300"
              />

              {result && !result.ok && (
                <div className="p-2.5 rounded bg-red-950/90 border border-red-500 text-xs text-red-200">
                  {result.message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-extrabold text-xs uppercase tracking-wider text-slate-950 cursor-pointer transition active:scale-95"
                style={{ backgroundColor: brand.secondaryColor }}
              >
                {loading
                  ? "VERIFICANDO HAVERSINE + PROOF OF HUNT..."
                  : "VALIDAR CAPTURA EN SERVIDOR"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-3 py-1">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-400/20 border-2 border-amber-300 text-amber-300 mx-auto">
              {result.claim?.claimType === "MAJOR_PRIZE" ? (
                <Award className="w-8 h-8" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-cyan-300" />
              )}
            </div>

            <p className="font-pixel text-[10px] text-amber-300 uppercase">
              {result.claim?.claimType === "MAJOR_PRIZE"
                ? "¡PREMIO MAYOR DESBLOQUEADO!"
                : "CUPÓN EXPLORADOR CURIOSO"}
            </p>

            <p className="text-xs text-slate-200 leading-relaxed">
              {result.message}
            </p>

            {result.claim && (
              <div className="p-3 rounded-lg bg-[#0b0518] border border-amber-400/50 space-y-1">
                <p className="text-[10px] uppercase text-slate-400">
                  Código Único de Canje
                </p>
                <p className="font-mono text-lg font-extrabold text-amber-300 tracking-widest">
                  {result.claim.couponCode}
                </p>
                <p className="text-xs font-semibold text-cyan-300">
                  {result.claim.prizeLabel}
                </p>
                <p className="text-[10px] text-slate-400">
                  Distancia GPS verificada: {result.claim.distanceAtClaimMeters}m
                  (Radio máx {result.claim.effectiveRadiusMeters}m)
                </p>
              </div>
            )}

            {result.claim?.whatsappRedeemUrl && (
              <a
                href={result.claim.whatsappRedeemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
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

