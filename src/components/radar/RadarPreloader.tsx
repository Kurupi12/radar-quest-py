"use client";

import React, { useEffect, useState } from "react";
import { Radio, Volume2, Shield, Zap, Sparkles } from "lucide-react";
import { BrandIconSvg } from "@/components/icons/BrandIconSvg";
import { arcadeHardware } from "@/lib/hardware/arcadeHardware";

interface RadarPreloaderProps {
  brandName: string;
  brandIconKey?: string | null;
  brandLogoUrl?: string | null;
  brandPrimaryColor?: string;
  onStart: () => void;
}

export function RadarPreloader({
  brandName,
  brandIconKey,
  brandLogoUrl,
  brandPrimaryColor = "#ec4899",
  onStart,
}: RadarPreloaderProps) {
  const [progress, setProgress] = useState(12);
  const [stageText, setStageText] = useState("CALIBRANDO SISTEMAS...");
  const [isReady, setIsReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    // 1. Iniciar precarga de pistas BGM adaptativas (Exploración + Tensión)
    arcadeHardware.preloadBgm();

    // 2. Simulación de inicialización de telemetría y precarga fluida
    const intervals: NodeJS.Timeout[] = [];

    const t1 = setTimeout(() => {
      setProgress(35);
      setStageText("PRECARGANDO BGM ADAPTATIVO...");
    }, 300);
    intervals.push(t1);

    const t2 = setTimeout(() => {
      setProgress(68);
      setStageText("SINTONIZANDO SENSOR TÉRMICO...");
    }, 750);
    intervals.push(t2);

    const t3 = setTimeout(() => {
      setProgress(92);
      setStageText("CALIBRANDO FRECUENCIA GPS...");
    }, 1200);
    intervals.push(t3);

    const t4 = setTimeout(() => {
      setProgress(100);
      setStageText("SISTEMA ONLINE • BGM EN BÚFER");
      setIsReady(true);
    }, 1500);
    intervals.push(t4);

    return () => {
      intervals.forEach(clearTimeout);
    };
  }, []);

  const handleLaunch = () => {
    if (!isReady || hasStarted) return;
    setHasStarted(true);

    // Inicializar AudioContext y reproducir BGM dentro del evento de toque (User Gesture)
    arcadeHardware.initAudioContext();
    arcadeHardware.playBgm();
    arcadeHardware.playPowerUpOnboarding();
    arcadeHardware.requestWakeLock();

    setTimeout(() => {
      onStart();
    }, 280);
  };

  const totalSegments = 16;
  const activeSegments = Math.round((progress / 100) * totalSegments);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#070311] px-4 transition-all duration-300 ${
        hasStarted ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
      }`}
    >
      {/* CRT Scanline & Grid Effect */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(18, 16, 38, 0) 50%, rgba(0, 0, 0, 0.45) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.05), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.05))",
          backgroundSize: "100% 4px, 6px 100%",
        }}
      />

      {/* Terminal Arcade Chassis Card */}
      <div
        className="relative w-full max-w-sm rounded-xl border-2 bg-[#120826] p-6 shadow-[0_0_50px_rgba(168,85,247,0.35)] flex flex-col items-center text-center overflow-hidden"
        style={{ borderColor: brandPrimaryColor }}
      >
        {/* 4 Screws in corners */}
        <div className="rf-screw absolute top-2.5 left-2.5" />
        <div className="rf-screw absolute top-2.5 right-2.5" />
        <div className="rf-screw absolute bottom-2.5 left-2.5" />
        <div className="rf-screw absolute bottom-2.5 right-2.5" />

        {/* Hazard Header Banner */}
        <div className="w-full bg-gradient-to-r from-purple-900/60 via-purple-700/80 to-purple-900/60 py-1 px-3 border-b border-purple-500/40 rounded-t flex items-center justify-between text-[10px] font-[family-name:var(--font-vt323)] text-purple-200 tracking-widest uppercase mb-4">
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            TELEMETRY V2.4
          </span>
          <span className="text-amber-400 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            ANTI-SPOOF SECURE
          </span>
        </div>

        {/* Brand Avatar / Icon */}
        <div className="relative mb-3 flex items-center justify-center">
          <div
            className="w-16 h-16 rounded-xl border-2 flex items-center justify-center bg-[#1c0f38] shadow-[0_0_20px_rgba(236,72,153,0.35)] overflow-hidden"
            style={{ borderColor: brandPrimaryColor }}
          >
            {brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandLogoUrl}
                alt={brandName}
                className="w-full h-full object-cover"
              />
            ) : (
              <BrandIconSvg
                iconKey={brandIconKey}
                className="w-9 h-9"
                color={brandPrimaryColor}
              />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded border border-black shadow">
            16-BIT
          </div>
        </div>

        {/* Brand & App Title */}
        <h1 className="text-lg font-black tracking-wider text-white uppercase font-[family-name:var(--font-space)] mb-0.5">
          {brandName}
        </h1>
        <p className="text-xs text-purple-300/80 tracking-widest font-[family-name:var(--font-press-start)] text-[9px] mb-4">
          RADAR QUEST PY
        </p>

        {/* 16-Bit Segmented Progress Bar */}
        <div className="w-full bg-[#0a0418] border border-purple-500/40 rounded-lg p-2.5 mb-4">
          <div className="flex items-center justify-between text-[11px] font-[family-name:var(--font-vt323)] text-purple-300 mb-1.5">
            <span className="flex items-center gap-1 text-cyan-300">
              <Zap className="w-3 h-3" />
              {stageText}
            </span>
            <span className="font-bold text-amber-300">{progress}%</span>
          </div>

          <div className="flex gap-1 h-3.5 bg-black/60 p-0.5 rounded border border-purple-900/60">
            {Array.from({ length: totalSegments }).map((_, i) => {
              const active = i < activeSegments;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-[1px] transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-t from-cyan-500 to-purple-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]"
                      : "bg-purple-950/30"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Status or Launch Button */}
        <div className="w-full min-h-[56px] flex items-center justify-center">
          {isReady ? (
            <button
              onClick={handleLaunch}
              className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-black font-[family-name:var(--font-press-start)] text-[11px] tracking-wider uppercase font-black border-2 border-emerald-200 shadow-[0_0_25px_rgba(16,185,129,0.7)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 animate-pulse cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-black shrink-0" />
              <span>INICIAR RADAR</span>
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-xs font-[family-name:var(--font-vt323)] text-purple-400 tracking-wider">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-300" />
              CARGANDO MOTOR RETROFUTURISTA...
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-[family-name:var(--font-vt323)] text-purple-400/70">
          <Volume2 className="w-3 h-3 text-emerald-400" />
          <span>AUDIO SYNTHWAVE & SENSOR GPS ACTIVOS AL TOCAR</span>
        </div>
      </div>
    </div>
  );
}
