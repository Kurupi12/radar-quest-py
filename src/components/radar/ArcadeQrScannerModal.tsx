"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  Camera,
  CheckCircle2,
  ExternalLink,
  Flame,
  RefreshCw,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import type { Brand, Hunter, PublicBrand, RadarClaimResponse } from "@/types/radar";
import { arcadeHardware } from "@/lib/hardware/arcadeHardware";

// Web API type declaration for BarcodeDetector
interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorInstance {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}

interface ArcadeQrScannerModalProps {
  brand: Brand | PublicBrand;
  hunter: Hunter;
  sessionToken: string;
  currentCoords: { lat: number; lng: number; accuracy: number };
  demoTokenHint?: string;
  onClose: () => void;
  onClaimSuccess?: (res: RadarClaimResponse) => void;
}

/**
 * Extracts token or reusable node code whether the physical QR encodes
 * a full URL (/b/brand/claim?token=XYZ) or a direct code (RQ-NODE-ENC-01).
 */
function parseQrPayload(raw: string): string {
  const trimmed = raw.trim();
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const tokenParam =
        url.searchParams.get("token") ||
        url.searchParams.get("node") ||
        url.searchParams.get("code");
      if (tokenParam) return tokenParam.trim();
    }
  } catch {
    // Not a URL, treat as raw token
  }
  return trimmed;
}

/**
 * 16-Bit Pixel Art Victory Fireworks & Golden Chest Canvas Animation
 */
function PixelVictoryCanvas({ isMajor }: { isMajor: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const W = 240;
    const H = 110;
    let tick = 0;
    let animId = 0;

    const palette = isMajor
      ? ["#fde047", "#ff0055", "#00f0ff", "#a855f7", "#4ade80"]
      : ["#00f0ff", "#38bdf8", "#a855f7", "#f8fafc"];

    const sparks = Array.from({ length: 34 }, (_, idx) => ({
      x: (idx * 37) % W,
      y: (idx * 23) % H,
      vy: 0.6 + (idx % 4) * 0.35,
      size: idx % 3 === 0 ? 4 : 3,
      color: palette[idx % palette.length],
    }));

    const loop = () => {
      tick += 1;
      ctx.clearRect(0, 0, W, H);

      // Pixel confetti / sparks
      for (const s of sparks) {
        s.y = (s.y + s.vy) % H;
        ctx.fillStyle = s.color;
        ctx.fillRect(
          Math.round(s.x / 2) * 2,
          Math.round(s.y / 2) * 2,
          s.size,
          s.size
        );
      }

      // 16-bit Pixel Trophy / Medal in center
      const cx = W / 2;
      const cy = H / 2 + (Math.floor(tick / 15) % 2 === 0 ? -2 : 2);

      if (isMajor) {
        // Golden 16-bit Trophy Cup
        ctx.fillStyle = "#090314";
        ctx.fillRect(cx - 22, cy - 26, 44, 52);
        ctx.fillStyle = "#facc15";
        ctx.fillRect(cx - 16, cy - 22, 32, 22);
        ctx.fillRect(cx - 22, cy - 18, 6, 12);
        ctx.fillRect(cx + 16, cy - 18, 6, 12);
        ctx.fillRect(cx - 6, cy, 12, 12);
        ctx.fillRect(cx - 14, cy + 12, 28, 8);
        // Shine pixel
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx - 10, cy - 18, 4, 10);
      } else {
        // 16-bit Cyber Explorer Badge
        ctx.fillStyle = "#090314";
        ctx.fillRect(cx - 18, cy - 20, 36, 40);
        ctx.fillStyle = "#00f0ff";
        ctx.fillRect(cx - 14, cy - 16, 28, 28);
        ctx.fillStyle = "#fde047";
        ctx.fillRect(cx - 6, cy - 8, 12, 12);
      }

      animId = window.requestAnimationFrame(loop);
    };

    animId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(animId);
  }, [isMajor]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={110}
      className="pixelated w-full h-28 rounded-lg bg-[#090314] border border-purple-500/40"
    />
  );
}

export function ArcadeQrScannerModal({
  brand,
  hunter,
  sessionToken,
  currentCoords,
  demoTokenHint = "",
  onClose,
  onClaimSuccess,
}: ArcadeQrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const claimingLockRef = useRef(false);

  const [engineLabel, setEngineLabel] = useState<string>("INICIANDO LENTE...");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<RadarClaimResponse | null>(
    null
  );
  const [manualCode, setManualCode] = useState(demoTokenHint);
  const [retryCount, setRetryCount] = useState(0);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const submitDecodedToken = useCallback(
    async (rawQrValue: string) => {
      if (claimingLockRef.current) return;
      const cleanToken = parseQrPayload(rawQrValue);
      if (!cleanToken) return;

      claimingLockRef.current = true;
      stopCamera();
      setClaiming(true);
      arcadeHardware.vibrate([60, 30, 90]);

      try {
        const res = await fetch("/api/radar/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokenOrNodeCode: cleanToken,
            brandSlug: brand.slug,
            lat: currentCoords.lat,
            lng: currentCoords.lng,
            accuracy: currentCoords.accuracy,
            hunterId: hunter.id,
            alias: hunter.alias,
            sessionToken,
          }),
        });

        const data = (await res.json()) as RadarClaimResponse;
        setClaimResult(data);

        // Re-verify Wake Lock stays active without any page reload
        arcadeHardware.requestWakeLock().catch(() => {});

        if (data.ok) {
          if (data.claim?.claimType === "MAJOR_PRIZE") {
            arcadeHardware.playVictoryFanfare();
          } else {
            arcadeHardware.playPowerUpOnboarding();
          }
          onClaimSuccess?.(data);
        } else {
          claimingLockRef.current = false;
        }
      } catch {
        setClaimResult({
          ok: false,
          message: "Error de conexión al validar el QR en el servidor.",
        });
        claimingLockRef.current = false;
      } finally {
        setClaiming(false);
      }
    },
    [
      brand.slug,
      currentCoords.accuracy,
      currentCoords.lat,
      currentCoords.lng,
      hunter.alias,
      hunter.id,
      onClaimSuccess,
      sessionToken,
      stopCamera,
    ]
  );

  // Start WebRTC Camera + BarcodeDetector primary engine with automatic jsQR fallback
  useEffect(() => {
    if (claimResult?.ok) return;
    let active = true;
    let scanTimer: number | null = null;

    const bootScanner = async () => {
      setCameraError(null);
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          "Tu navegador no expone cámara WebRTC en este contexto (requiere HTTPS o localhost)."
        );
        setEngineLabel("MODO MANUAL / QA");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 720 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Detect native BarcodeDetector support
        let nativeDetector: BarcodeDetectorInstance | null = null;
        const win = window as unknown as {
          BarcodeDetector?: BarcodeDetectorConstructor;
        };

        if (win.BarcodeDetector) {
          try {
            const supported = win.BarcodeDetector.getSupportedFormats
              ? await win.BarcodeDetector.getSupportedFormats()
              : ["qr_code"];
            if (supported.includes("qr_code")) {
              nativeDetector = new win.BarcodeDetector({
                formats: ["qr_code"],
              });
            }
          } catch {
            nativeDetector = null;
          }
        }

        setEngineLabel(
          nativeDetector
            ? "BARCODE DETECTOR API (NATIVO)"
            : "JSQR FALLBACK ENGINE (60FPS)"
        );

        let isProcessing = false;

        const scanFrame = async () => {
          if (!active || claimingLockRef.current || isProcessing) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;

          isProcessing = true;
          try {
            // 1. Primary Engine: Native BarcodeDetector API
            if (nativeDetector) {
              try {
                const codes = await nativeDetector.detect(video);
                if (codes.length > 0 && codes[0]?.rawValue) {
                  await submitDecodedToken(codes[0].rawValue);
                  return;
                }
              } catch {
                // If native detector fails on device GPU, switch permanently to jsQR
                nativeDetector = null;
                setEngineLabel("JSQR FALLBACK ENGINE (60FPS)");
              }
            } else {
              // 2. Fallback Engine: jsQR (only when native is not available)
              const canvas = workCanvasRef.current;
              if (canvas && video.videoWidth > 0 && video.videoHeight > 0) {
                const size = 320;
                if (canvas.width !== size || canvas.height !== size) {
                  canvas.width = size;
                  canvas.height = size;
                }
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                if (ctx) {
                  ctx.drawImage(video, 0, 0, size, size);
                  const imageData = ctx.getImageData(0, 0, size, size);
                  const decoded = jsQR(imageData.data, size, size, {
                    inversionAttempts: "dontInvert",
                  });
                  if (decoded && decoded.data) {
                    await submitDecodedToken(decoded.data);
                    return;
                  }
                }
              }
            }
          } finally {
            isProcessing = false;
          }
        };

        scanTimer = window.setInterval(scanFrame, 150);
      } catch {
        setCameraError(
          "Permiso de cámara denegado o sin webcam disponible. Podés reintentar o validar el código del cartel abajo."
        );
        setEngineLabel("SIN SEÑAL DE CÁMARA");
      }
    };

    bootScanner();

    return () => {
      active = false;
      if (scanTimer) window.clearInterval(scanTimer);
      stopCamera();
    };
  }, [claimResult?.ok, retryCount, stopCamera, submitDecodedToken]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-[#090314]/92 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-[380px] rf-panel rf-panel-cyan p-4 text-white shadow-[0_0_50px_rgba(0,0,0,0.95)] relative overflow-hidden">
        {/* 4 Corner Rivet Screws */}
        <div className="rf-screw rf-screw-tl" />
        <div className="rf-screw rf-screw-tr" />
        <div className="rf-screw rf-screw-bl" />
        <div className="rf-screw rf-screw-br" />

        {/* Top-Right Hazard Warning Caution Tab */}
        <div className="absolute top-0 right-0 w-24 h-3 rf-hazard-stripes-cyan border-b border-l border-cyan-500/60" />

        <button
          type="button"
          onClick={handleClose}
          className="absolute top-2.5 right-2.5 z-20 p-1.5 rf-btn-steel text-xs"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* ================================================================ */}
        {/* VIEW 1: LIVE RETRO-ARCADE CAMERA + PIXEL NEON RETICLE            */}
        {/* ================================================================ */}
        {!claimResult?.ok ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 pr-8">
              <div className="p-2 rounded-lg bg-red-500/20 border border-red-400/50 text-amber-300">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <p className="font-pixel text-[8px] text-amber-300 uppercase flex items-center gap-1">
                  <Flame className="w-3 h-3 text-rose-400" />
                  <span>ZONA ¡QUEMANDO! (&lt;30M) DESBLOQUEADA</span>
                </p>
                <h3 className="font-extrabold text-sm text-white">
                  Escáner Óptico QR Retro-Arcade
                </h3>
              </div>
            </div>

            {/* 1:1 Retro Viewfinder with Pixelated Neon Reticle */}
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-[#080312] border-2 border-cyan-400/60">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={workCanvasRef} className="hidden" />

              {/* CRT Scanlines */}
              <div className="crt-scanlines pointer-events-none absolute inset-0 opacity-40" />

              {/* PIXELATED NEON CROSSHAIR / MIRA NEÓN PIXELADA */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-7">
                <div className="relative w-full h-full">
                  {/* Stepped 16-Bit Neon Corners */}
                  <div className="absolute top-0 left-0 w-8 h-2 bg-cyan-300 shadow-[0_0_10px_#00f0ff]" />
                  <div className="absolute top-0 left-0 w-2 h-8 bg-cyan-300 shadow-[0_0_10px_#00f0ff]" />

                  <div className="absolute top-0 right-0 w-8 h-2 bg-cyan-300 shadow-[0_0_10px_#00f0ff]" />
                  <div className="absolute top-0 right-0 w-2 h-8 bg-cyan-300 shadow-[0_0_10px_#00f0ff]" />

                  <div className="absolute bottom-0 left-0 w-8 h-2 bg-pink-500 shadow-[0_0_10px_#ff007f]" />
                  <div className="absolute bottom-0 left-0 w-2 h-8 bg-pink-500 shadow-[0_0_10px_#ff007f]" />

                  <div className="absolute bottom-0 right-0 w-8 h-2 bg-pink-500 shadow-[0_0_10px_#ff007f]" />
                  <div className="absolute bottom-0 right-0 w-2 h-8 bg-pink-500 shadow-[0_0_10px_#ff007f]" />

                  {/* Center Pixel Crosshair */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-amber-300 bg-amber-300/20" />
                  </div>

                  {/* Animated Laser Scan Bar (Fluido hacia arriba y abajo) */}
                  <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#00f0ff] animate-laser-scan" />
                </div>
              </div>

              {/* Engine Telemetry Badge */}
              <div className="absolute bottom-2 inset-x-2 flex items-center justify-between px-2.5 py-1 rounded bg-[#0c051c]/90 border border-purple-500/40 text-[9px] font-mono text-cyan-300">
                <span>{engineLabel}</span>
                <span className="text-amber-300 animate-pulse">● SCANNING</span>
              </div>

              {claiming && (
                <div className="absolute inset-0 bg-[#0c051c]/90 flex flex-col items-center justify-center gap-2 text-center p-4">
                  <RefreshCw className="w-7 h-7 text-cyan-300 animate-spin" />
                  <p className="font-pixel text-[9px] text-amber-300">
                    VALIDANDO CAPTURA ATÓMICA...
                  </p>
                </div>
              )}
            </div>

            {cameraError && (
              <div className="p-2.5 rounded-lg bg-amber-950/80 border border-amber-400/60 text-[11px] text-amber-200 flex items-center justify-between gap-2">
                <span>{cameraError}</span>
                <button
                  type="button"
                  onClick={() => setRetryCount((c) => c + 1)}
                  className="px-2 py-1 rounded bg-amber-400 text-slate-950 font-bold text-[10px] shrink-0 cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            )}

            {claimResult && !claimResult.ok && (
              <div className="p-2.5 rounded-lg bg-red-950/90 border border-red-500 text-xs text-red-200">
                {claimResult.message}
              </div>
            )}

            {/* Fallback Code Input / Desktop QA Trigger (Zero Page Reload) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitDecodedToken(manualCode);
              }}
              className="pt-1 space-y-2 border-t border-slate-700/60"
            >
              <label className="block text-[10px] uppercase text-cyan-300 font-bold tracking-wider">
                ¿Cartel dañado o probando en PC? Ingresá el Nodo:
              </label>
              <div className="flex gap-1.5">
                <div className="flex-1 rf-input-slot rf-input-slot-cyan">
                  <input
                    type="text"
                    placeholder="Ej: RQ-NODE-ENC-01"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-transparent font-mono text-xs uppercase text-cyan-200 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={claiming || !manualCode.trim()}
                  className="px-3.5 py-1.5 rf-btn-cyan text-xs disabled:opacity-40"
                >
                  Validar
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ================================================================ */
          /* VIEW 2: ATOMIC VICTORY PIXEL ART OR CONSOLATION COUPON SCREEN    */
          /* ================================================================ */
          <div className="space-y-3 text-center py-1">
            <PixelVictoryCanvas
              isMajor={claimResult.claim?.claimType === "MAJOR_PRIZE"}
            />

            <div className="flex justify-center -mt-1 mb-1">
              <div
                className={`px-5 py-1.5 rounded-sm text-sm flex items-center justify-center gap-2 ${
                  claimResult.claim?.claimType === "MAJOR_PRIZE"
                    ? "rf-tab-won"
                    : "rf-tab-cyan"
                }`}
              >
                {claimResult.claim?.claimType === "MAJOR_PRIZE" ? (
                  <>
                    <Trophy className="w-4 h-4 shrink-0 text-amber-950" />
                    <span>¡YOU WON! PREMIO MAYOR</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 shrink-0 text-cyan-950" />
                    <span>CUPÓN DE CONSUELO</span>
                  </>
                )}
              </div>
            </div>

            {/* "REWARDS :" Label (Directly from reference UI kit) */}
            <div className="flex justify-center my-1">
              <div className="rf-rewards-banner text-xs">
                <span>REWARDS :</span>
              </div>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed font-semibold">
              {claimResult.message}
            </p>

            {claimResult.claim && (
              <div className="p-3 rounded-lg bg-[#050813] border-2 border-amber-400/60 space-y-1 shadow-inner">
                <p className="text-[10px] uppercase text-slate-400 tracking-wider">
                  Cupón Oficial • {brand.name}
                </p>
                <p className="font-mono text-lg font-black text-amber-300 tracking-widest">
                  {claimResult.claim.couponCode}
                </p>
                <p className="text-xs font-bold text-cyan-300">
                  {claimResult.claim.prizeLabel}
                </p>
                <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1 pt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>
                    GPS validado a {claimResult.claim.distanceAtClaimMeters}m •
                    Wake Lock activo
                  </span>
                </p>
              </div>
            )}

            {claimResult.claim?.whatsappRedeemUrl && (
              <a
                href={claimResult.claim.whatsappRedeemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rf-btn-emerald text-xs tracking-wider flex items-center justify-center gap-2"
              >
                <span>CANJEAR EN WHATSAPP DE {brand.name}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

