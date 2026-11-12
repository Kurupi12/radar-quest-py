"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Film, Share2, Sparkles, X } from "lucide-react";
import fixWebmDuration from "fix-webm-duration";
import type { Brand, PublicBrand, PublicMission, ThermalState } from "@/types/radar";

interface ViralRecorderProps {
  brand: Brand | PublicBrand;
  mission: PublicMission | null;
  hunterAlias: string;
  thermalState: ThermalState;
  activeHunters: number;
  getMapCanvas: () => HTMLCanvasElement | null;
  getOverlayCanvas: () => HTMLCanvasElement | null;
}

// 9:16 Vertical Story format for Instagram / TikTok Stories (15 seconds standard)
const STORY_WIDTH = 540;
const STORY_HEIGHT = 960;
const INSTAGRAM_STORY_SECONDS = 15;

/**
 * 16-Bit Metallic Corner Screw for Canvas
 */
function drawCanvasScrew(ctx: CanvasRenderingContext2D, x: number, y: number, r = 5) {
  ctx.save();
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  grad.addColorStop(0, "#cbd5e1");
  grad.addColorStop(0.5, "#64748b");
  grad.addColorStop(1, "#1e293b");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.6, y);
  ctx.lineTo(x + r * 0.6, y);
  ctx.moveTo(x, y - r * 0.6);
  ctx.lineTo(x, y + r * 0.6);
  ctx.stroke();
  ctx.restore();
}

/**
 * Diagonal Hazard Warning Stripes Tab for Canvas
 */
function drawCanvasHazardStripes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c1 = "#f59e0b",
  c2 = "#1e293b"
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = c2;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = c1;
  const stripeWidth = 10;
  for (let sx = -h; sx < w + h; sx += stripeWidth * 2) {
    ctx.beginPath();
    ctx.moveTo(x + sx, y);
    ctx.lineTo(x + sx + stripeWidth, y);
    ctx.lineTo(x + sx + stripeWidth + h, y + h);
    ctx.lineTo(x + sx + h, y + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 16-Bit Retro Chassis Panel with 3D Bevel & Screws for Canvas
 */
function drawCanvas3DPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  borderColor = "#475569",
  fillColor = "rgba(9, 14, 29, 0.94)"
) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;

  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, w, h);

  ctx.shadowColor = "transparent";
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);

  // Highlight upper-left
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h - 2);
  ctx.lineTo(x + 2, y + 2);
  ctx.lineTo(x + w - 2, y + 2);
  ctx.stroke();

  // Shadow bottom-right
  ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
  ctx.beginPath();
  ctx.moveTo(x + w - 2, y + 2);
  ctx.lineTo(x + w - 2, y + h - 2);
  ctx.lineTo(x + 2, y + h - 2);
  ctx.stroke();

  // 4 Corner Screws
  const m = 11;
  drawCanvasScrew(ctx, x + m, y + m);
  drawCanvasScrew(ctx, x + w - m, y + m);
  drawCanvasScrew(ctx, x + m, y + h - m);
  drawCanvasScrew(ctx, x + w - m, y + h - m);
  ctx.restore();
}

/**
 * Tactical Stepped 16-Bit Viewfinder Neon Brackets
 */
function drawSteppedViewfinderCorners(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pad = 20,
  len = 42,
  thick = 4,
  col1 = "#00f0ff",
  col2 = "#ff007f"
) {
  ctx.save();
  ctx.fillStyle = col1;
  ctx.shadowColor = col1;
  ctx.shadowBlur = 10;
  ctx.fillRect(pad, pad, len, thick);
  ctx.fillRect(pad, pad, thick, len);
  ctx.fillRect(w - pad - len, pad, len, thick);
  ctx.fillRect(w - pad - thick, pad, thick, len);

  ctx.fillStyle = col2;
  ctx.shadowColor = col2;
  ctx.shadowBlur = 10;
  ctx.fillRect(pad, h - pad - thick, len, thick);
  ctx.fillRect(pad, h - pad - len, thick, len);
  ctx.fillRect(w - pad - len, h - pad - thick, len, thick);
  ctx.fillRect(w - pad - thick, h - pad - len, thick, len);
  ctx.restore();
}

export function ViralRecorder({
  brand,
  mission,
  hunterAlias,
  thermalState,
  activeHunters,
  getMapCanvas,
  getOverlayCanvas,
}: ViralRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [cleanMimeType, setCleanMimeType] = useState<string>("video/mp4");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animIdRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const livePropsRef = useRef({
    brand,
    mission,
    hunterAlias,
    thermalState,
    activeHunters,
  });
  livePropsRef.current = {
    brand,
    mission,
    hunterAlias,
    thermalState,
    activeHunters,
  };

  useEffect(() => {
    return () => {
      if (animIdRef.current) window.cancelAnimationFrame(animIdRef.current);
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /**
   * Renders a single 9:16 story frame to the canvas with Retrofuturistic 16-Bit Cockpit HUD
   */
  const renderCompositeFrame = (
    ctx: CanvasRenderingContext2D,
    frameTick: number
  ) => {
    const {
      brand: b,
      mission: m,
      hunterAlias: alias,
      thermalState: thermal,
      activeHunters: huntersCount,
    } = livePropsRef.current;

    ctx.imageSmoothingEnabled = false;

    // 1. Base dark background
    ctx.fillStyle = "#080d1a";
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

    // 2. Draw Live MapLibre Canvas (centered crop to 540x960)
    const mapCanvas = getMapCanvas();
    if (mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) {
      try {
        const scale = Math.max(
          STORY_WIDTH / mapCanvas.width,
          STORY_HEIGHT / mapCanvas.height
        );
        const dw = mapCanvas.width * scale;
        const dh = mapCanvas.height * scale;
        const dx = (STORY_WIDTH - dw) / 2;
        const dy = (STORY_HEIGHT - dh) / 2;
        ctx.drawImage(mapCanvas, dx, dy, dw, dh);
      } catch {}
    }

    // 3. Draw Pixel Radar Overlay (360x640 -> scaled to 540x960)
    const overlayCanvas = getOverlayCanvas();
    if (overlayCanvas) {
      ctx.drawImage(overlayCanvas, 0, 0, STORY_WIDTH, STORY_HEIGHT);
    }

    // 4. CRT / VHS Scanlines
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    for (let y = 0; y < STORY_HEIGHT; y += 6) {
      ctx.fillRect(0, y, STORY_WIDTH, 2);
    }

    // 5. Tactical Stepped Viewfinder Brackets
    drawSteppedViewfinderCorners(ctx, STORY_WIDTH, STORY_HEIGHT, 20, 44, 4, "#00f0ff", "#ff007f");

    // 6. Retrofuturistic 16-Bit Top HUD Bar (Cockpit Panel)
    const topPanelX = 24;
    const topPanelY = 24;
    const topPanelW = STORY_WIDTH - 48;
    const topPanelH = 88;

    drawCanvas3DPanel(ctx, topPanelX, topPanelY, topPanelW, topPanelH, b.primaryColor || "#a855f7");
    drawCanvasHazardStripes(
      ctx,
      topPanelX + topPanelW - 85,
      topPanelY,
      85,
      12,
      "#00f0ff",
      "#0a1128"
    );

    // REC Blinking LED + Label
    if (Math.floor(frameTick / 15) % 2 === 0) {
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(topPanelX + 28, topPanelY + 28, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "transparent";
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 17px monospace";
    ctx.fillText("REC • RADAR QUEST 16-BIT", topPanelX + 44, topPanelY + 34);

    const nowStr = new Date().toLocaleString("es-PY", { hour12: false });
    ctx.fillStyle = "#94a3b8";
    ctx.font = "700 12px monospace";
    ctx.fillText(`${nowStr} | CAZADOR: ${alias.toUpperCase()}`, topPanelX + 24, topPanelY + 64);

    // 7. Thermal Status Cockpit Plaque (Identical to live game HUD)
    const thermalPlatX = 36;
    const thermalPlatY = 124;
    const thermalPlatW = STORY_WIDTH - 72;
    const thermalPlatH = 58;

    const isQuemando = thermal === "QUEMANDO";
    const isCaliente = thermal === "CALIENTE";
    const thermalBorder = isQuemando ? "#ef4444" : isCaliente ? "#f59e0b" : "#0284c7";
    const thermalBg = isQuemando ? "rgba(35, 8, 16, 0.94)" : "rgba(8, 14, 28, 0.94)";

    drawCanvas3DPanel(ctx, thermalPlatX, thermalPlatY, thermalPlatW, thermalPlatH, thermalBorder, thermalBg);

    if (isQuemando) {
      drawCanvasHazardStripes(ctx, thermalPlatX + thermalPlatW - 65, thermalPlatY, 65, 10, "#ef4444", "#1a080c");
      drawCanvasHazardStripes(ctx, thermalPlatX, thermalPlatY, 65, 10, "#ef4444", "#1a080c");
    }

    ctx.textAlign = "center";
    ctx.font = "900 24px monospace";
    const thermalLabel =
      isQuemando
        ? "¡QUEMANDO! (<30M) • TESORO CERCA"
        : isCaliente
        ? "¡CALIENTE! (<100M) • ONDA FUERTE"
        : thermal === "TIBIO"
        ? "TIBIO (ZONA PRÓXIMA)"
        : "CONGELADO • RASTREANDO ÁREA";

    // 3D Shadow for thermal text
    ctx.fillStyle = "#000000";
    ctx.fillText(thermalLabel, STORY_WIDTH / 2 + 2, thermalPlatY + 38);

    ctx.fillStyle = isQuemando ? "#ff2a55" : isCaliente ? "#fbbf24" : "#38bdf8";
    ctx.fillText(thermalLabel, STORY_WIDTH / 2, thermalPlatY + 36);

    // 8. Bottom White-Label Brand Chassis Card
    const botPanelX = 24;
    const botPanelY = STORY_HEIGHT - 150;
    const botPanelW = STORY_WIDTH - 48;
    const botPanelH = 120;

    drawCanvas3DPanel(ctx, botPanelX, botPanelY, botPanelW, botPanelH, b.primaryColor || "#a855f7");
    drawCanvasHazardStripes(
      ctx,
      botPanelX + botPanelW - 90,
      botPanelY,
      90,
      12,
      "#f59e0b",
      "#1e293b"
    );

    // Brand Name with 3D Relief
    ctx.textAlign = "center";
    ctx.fillStyle = "#000000";
    ctx.font = "900 22px monospace";
    const brandTitle = `${b.name.toUpperCase()}${b.requireAdult18 ? " (+18)" : ""}`;
    ctx.fillText(brandTitle, STORY_WIDTH / 2 + 1, botPanelY + 37);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(brandTitle, STORY_WIDTH / 2, botPanelY + 35);

    // Mission Title and City in Neon Cyan
    ctx.fillStyle = b.secondaryColor || "#00f0ff";
    ctx.font = "700 15px monospace";
    ctx.fillText(
      m ? `${m.title} • ${m.city}` : "Caza del Tesoro QR • Paraguay",
      STORY_WIDTH / 2,
      botPanelY + 66
    );

    // Active Hunters Badge
    ctx.fillStyle = "#facc15";
    ctx.font = "900 13px monospace";
    ctx.fillText(
      `${huntersCount} CAZADORES ACTIVOS • #RadarQuestPY`,
      STORY_WIDTH / 2,
      botPanelY + 95
    );
    ctx.textAlign = "left";
  };

  /**
   * Start 15-second Video Recording
   */
  const startViralRecording = () => {
    setRecordedBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setShowPreviewModal(false);

    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = STORY_WIDTH;
    compositeCanvas.height = STORY_HEIGHT;
    const ctx = compositeCanvas.getContext("2d");
    if (!ctx) return;

    let frameTick = 0;
    const drawNextFrame = () => {
      frameTick += 1;
      renderCompositeFrame(ctx, frameTick);
    };

    drawNextFrame();

    // 30 FPS steady animation loop
    let lastRenderTime = performance.now();
    const frameIntervalMs = 1000 / 30;

    const renderLoop = (timestamp: number) => {
      const elapsed = timestamp - lastRenderTime;
      if (elapsed >= frameIntervalMs) {
        lastRenderTime = timestamp - (elapsed % frameIntervalMs);
        drawNextFrame();
      }
      animIdRef.current = window.requestAnimationFrame(renderLoop);
    };
    animIdRef.current = window.requestAnimationFrame(renderLoop);

    const stream = compositeCanvas.captureStream(30);

    const mimeCandidates = [
      "video/mp4",
      "video/webm;codecs=vp8",
      "video/webm;codecs=vp9",
      "video/webm",
    ];
    const selectedFormat =
      mimeCandidates.find((m) =>
        typeof MediaRecorder !== "undefined" ? MediaRecorder.isTypeSupported(m) : false
      ) || "video/webm";

    const cleanBaseMime = selectedFormat.includes("mp4")
      ? "video/mp4"
      : "video/webm";
    setCleanMimeType(cleanBaseMime);

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: selectedFormat,
      videoBitsPerSecond: 3_000_000,
    });

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    const startTimestamp = Date.now();

    recorder.onstop = async () => {
      if (animIdRef.current) {
        window.cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const durationMs = Math.max(1000, Date.now() - startTimestamp);
      const rawBlob = new Blob(chunks, { type: cleanBaseMime });

      let finalBlob = rawBlob;
      if (cleanBaseMime === "video/webm") {
        try {
          finalBlob = await fixWebmDuration(rawBlob, durationMs);
        } catch {
          finalBlob = rawBlob;
        }
      }

      setRecordedBlob(finalBlob);
      const url = URL.createObjectURL(finalBlob);
      setPreviewUrl(url);
      setShowPreviewModal(true);
      setIsRecording(false);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();

    setIsRecording(true);
    setSecondsElapsed(0);

    timerRef.current = window.setInterval(() => {
      setSecondsElapsed((prev) => {
        if (prev >= INSTAGRAM_STORY_SECONDS - 1) {
          if (recorder.state === "recording") {
            recorder.stop();
          }
          return INSTAGRAM_STORY_SECONDS;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopViralRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  const shareOrDownloadClip = async () => {
    if (!recordedBlob) return;
    const ext = cleanMimeType.includes("mp4") ? "mp4" : "webm";
    const filename = `radar-quest-${brand.slug}-${Date.now()}.${ext}`;

    const file = new File([recordedBlob], filename, { type: cleanMimeType });

    if (
      typeof navigator !== "undefined" &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: `¡Buscando el tesoro de ${brand.name} en Radar Quest!`,
          text: `Estoy en modo ${thermalState} buscando el tesoro de ${brand.name} #RadarQuestPY`,
          files: [file],
        });
        return;
      } catch {
        // Fallback to download only if user aborts or browser blocks share
      }
    }

    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleDownloadOnly = () => {
    if (!recordedBlob) return;
    const ext = cleanMimeType.includes("mp4") ? "mp4" : "webm";
    const filename = `radar-quest-${brand.slug}-${Date.now()}.${ext}`;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        {!isRecording ? (
          <button
            type="button"
            onClick={startViralRecording}
            className="px-3.5 py-2 rf-btn-crimson text-xs leading-none"
            title="Graba video de 15 segundos para Historias de Instagram/TikTok"
          >
            <span>GRABAR PARA REDES</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={stopViralRecording}
            className="px-3.5 py-2 rf-btn-crimson text-xs leading-none animate-pulse"
          >
            <span>
              REC 00:{String(secondsElapsed).padStart(2, "0")}/
              {INSTAGRAM_STORY_SECONDS}S
            </span>
          </button>
        )}

        {recordedBlob && !isRecording && (
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-3 py-2 rf-btn-emerald text-xs leading-none"
            title="Ver video grabado y compartir"
          >
            <span>VER / COMPARTIR</span>
          </button>
        )}
      </div>

      {/* ================================================================ */}
      {/* MODAL RETROFUTURISTA: VISTA PREVIA Y COMPARTIR VIDEO 15S STORIES */}
      {/* ================================================================ */}
      {showPreviewModal && previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-[340px] rf-panel rf-panel-gold p-4 text-white shadow-[0_0_50px_rgba(0,0,0,0.95)] relative overflow-hidden">
            {/* 4 Corner Screws */}
            <div className="rf-screw rf-screw-tl" />
            <div className="rf-screw rf-screw-tr" />
            <div className="rf-screw rf-screw-bl" />
            <div className="rf-screw rf-screw-br" />

            {/* Top-Right Hazard Warning Caution Tab */}
            <div className="absolute top-0 right-0 w-24 h-3 rf-hazard-stripes border-b border-l border-amber-600/70" />

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowPreviewModal(false)}
              className="absolute top-2.5 right-2.5 z-20 p-1.5 rf-btn-steel text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Header Tab */}
            <div className="flex justify-center -mt-1 mb-2.5">
              <div className="rf-nameplate text-amber-300 text-[10px] tracking-wider">
                <Film className="w-3.5 h-3.5 text-amber-400" />
                <span>VIDEO 15S LISTO • REDES SOCIALES</span>
              </div>
            </div>

            {/* 9:16 Video Player Chassis */}
            <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-black border-2 border-amber-400/60 shadow-inner mb-3">
              <video
                src={previewUrl}
                autoPlay
                loop
                playsInline
                controls
                className="w-full h-full object-cover"
              />
              <div className="crt-scanlines pointer-events-none absolute inset-0 opacity-25" />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={shareOrDownloadClip}
                className="w-full py-2.5 px-3 rf-btn-emerald text-xs tracking-wider flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>COMPARTIR EN TIKTOK / INSTAGRAM</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadOnly}
                className="w-full py-2 px-3 rf-btn-cyan text-xs tracking-wider flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>DESCARGAR ARCHIVO MP4</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
