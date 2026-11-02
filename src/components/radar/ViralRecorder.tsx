"use client";

import { useEffect, useRef, useState } from "react";
import { Circle, Download, Share2, Square, Video } from "lucide-react";
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

// 9:16 Vertical Story format optimized for real-time 30 FPS capture without frame drops
const STORY_WIDTH = 540;
const STORY_HEIGHT = 960;
const MAX_RECORDING_SECONDS = 30;

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
  const [recordedMime, setRecordedMime] = useState<string>("video/webm");

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
    };
  }, []);

  const startViralRecording = () => {
    setRecordedBlob(null);
    const compositeCanvas = document.createElement("canvas");
    compositeCanvas.width = STORY_WIDTH;
    compositeCanvas.height = STORY_HEIGHT;
    const ctx = compositeCanvas.getContext("2d");
    if (!ctx) return;

    let frameTick = 0;

    const drawStoryFrame = () => {
      frameTick += 1;
      const {
        brand: b,
        mission: m,
        hunterAlias: alias,
        thermalState: thermal,
        activeHunters: huntersCount,
      } = livePropsRef.current;

      ctx.imageSmoothingEnabled = false;

      // 1. Base background
      ctx.fillStyle = "#140b29";
      ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

      // 2. Draw Live MapLibre Canvas (cover-crop centered to 1080x1920)
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
        } catch {
          // Fallback grid if WebGL context busy
        }
      }

      // 3. Draw 60FPS Pixel Radar Overlay (360x640 -> exact 3x integer scale 1080x1920!)
      const overlayCanvas = getOverlayCanvas();
      if (overlayCanvas) {
        ctx.drawImage(overlayCanvas, 0, 0, STORY_WIDTH, STORY_HEIGHT);
      }

      // 4. VHS Scanlines & Corner Viewfinder Frame
      ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
      for (let y = 0; y < STORY_HEIGHT; y += 6) {
        ctx.fillRect(0, y, STORY_WIDTH, 2);
      }

      ctx.strokeStyle = b.secondaryColor || "#00f0ff";
      ctx.lineWidth = 4;
      const pad = 24;
      const corner = 45;
      // Top-left bracket
      ctx.beginPath();
      ctx.moveTo(pad, pad + corner);
      ctx.lineTo(pad, pad);
      ctx.lineTo(pad + corner, pad);
      // Top-right bracket
      ctx.moveTo(STORY_WIDTH - pad - corner, pad);
      ctx.lineTo(STORY_WIDTH - pad, pad);
      ctx.lineTo(STORY_WIDTH - pad, pad + corner);
      // Bottom-left bracket
      ctx.moveTo(pad, STORY_HEIGHT - pad - corner);
      ctx.lineTo(pad, STORY_HEIGHT - pad);
      ctx.lineTo(pad + corner, STORY_HEIGHT - pad);
      // Bottom-right bracket
      ctx.moveTo(STORY_WIDTH - pad - corner, STORY_HEIGHT - pad);
      ctx.lineTo(STORY_WIDTH - pad, STORY_HEIGHT - pad);
      ctx.lineTo(STORY_WIDTH - pad, STORY_HEIGHT - pad - corner);
      ctx.stroke();

      // 5. VHS '● REC' & Live Timestamp Header
      ctx.fillStyle = "rgba(15, 7, 34, 0.88)";
      ctx.fillRect(38, 38, STORY_WIDTH - 76, 82);
      ctx.strokeStyle = b.primaryColor || "#a855f7";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(38, 38, STORY_WIDTH - 76, 82);

      // Blinking REC dot
      if (Math.floor(frameTick / 15) % 2 === 0) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(64, 64, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px monospace";
      ctx.fillText("REC • VHS 16-BIT", 82, 71);

      const nowStr = new Date().toLocaleString("es-PY", { hour12: false });
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px monospace";
      ctx.fillText(`${nowStr} | CAZADOR: ${alias}`, 54, 102);

      // 6. Thermal Status HUD Banner
      const thermalColor =
        thermal === "QUEMANDO"
          ? "#ff0055"
          : thermal === "CALIENTE"
          ? "#fb923c"
          : thermal === "TIBIO"
          ? "#facc15"
          : "#38bdf8";

      ctx.fillStyle = "rgba(15, 7, 34, 0.92)";
      ctx.fillRect(50, 134, STORY_WIDTH - 100, 58);
      ctx.strokeStyle = thermalColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(50, 134, STORY_WIDTH - 100, 58);

      ctx.fillStyle = thermalColor;
      ctx.textAlign = "center";
      ctx.font = "bold 26px monospace";
      ctx.fillText(`RADAR: ${thermal}`, STORY_WIDTH / 2, 172);

      // 7. Bottom White-Label Brand Card for TikTok / IG Stories
      ctx.fillStyle = "rgba(15, 7, 34, 0.94)";
      ctx.fillRect(38, STORY_HEIGHT - 150, STORY_WIDTH - 76, 110);
      ctx.strokeStyle = b.primaryColor || "#a855f7";
      ctx.lineWidth = 3;
      ctx.strokeRect(38, STORY_HEIGHT - 150, STORY_WIDTH - 76, 110);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px monospace";
      ctx.fillText(
        `${b.name.toUpperCase()}${b.requireAdult18 ? " (+18)" : ""}`,
        STORY_WIDTH / 2,
        STORY_HEIGHT - 112
      );

      ctx.fillStyle = b.secondaryColor || "#00f0ff";
      ctx.font = "15px monospace";
      ctx.fillText(
        m ? `${m.title} • ${m.city}` : "Caza del Tesoro QR • Paraguay",
        STORY_WIDTH / 2,
        STORY_HEIGHT - 85
      );

      ctx.fillStyle = "#fde047";
      ctx.font = "13px monospace";
      ctx.fillText(
        `${huntersCount} CAZADORES ACTIVOS • #RadarQuestPY`,
        STORY_WIDTH / 2,
        STORY_HEIGHT - 58
      );
      ctx.textAlign = "left";
    };

    drawStoryFrame();
    // High-performance smooth 30 FPS composition loop without thread choking
    let lastRenderTime = performance.now();
    const frameIntervalMs = 1000 / 30;

    const renderLoop = (timestamp: number) => {
      const elapsed = timestamp - lastRenderTime;
      if (elapsed >= frameIntervalMs) {
        lastRenderTime = timestamp - (elapsed % frameIntervalMs);
        drawStoryFrame();
      }
      animIdRef.current = window.requestAnimationFrame(renderLoop);
    };
    animIdRef.current = window.requestAnimationFrame(renderLoop);

    const stream = compositeCanvas.captureStream(30);
    const mimeCandidates = [
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const selectedMime =
      mimeCandidates.find((m) =>
        typeof MediaRecorder !== "undefined" ? MediaRecorder.isTypeSupported(m) : false
      ) || "video/webm";

    setRecordedMime(selectedMime);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: selectedMime,
      videoBitsPerSecond: 3_500_000,
    });

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    recorder.onstop = () => {
      if (animIdRef.current) {
        window.cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const finalBlob = new Blob(chunks, { type: selectedMime });
      setRecordedBlob(finalBlob);
      setIsRecording(false);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250);
    setIsRecording(true);
    setSecondsElapsed(0);

    timerRef.current = window.setInterval(() => {
      setSecondsElapsed((prev) => {
        if (prev >= MAX_RECORDING_SECONDS - 1) {
          recorder.stop();
          return MAX_RECORDING_SECONDS;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopViralRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  const shareOrDownloadClip = async () => {
    if (!recordedBlob) return;
    const ext = recordedMime.includes("mp4") ? "mp4" : "webm";
    const filename = `radar-quest-${brand.slug}-${Date.now()}.${ext}`;
    const file = new File([recordedBlob], filename, { type: recordedMime });

    if (
      typeof navigator !== "undefined" &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: `¡Buscando el tesoro de ${brand.name} en Radar Quest!`,
          text: `Estoy en modo ${thermalState} buscando el QR oculto de ${brand.name} #RadarQuestPY`,
          files: [file],
        });
        return;
      } catch {
        // Fallback to download if user cancels or desktop browser blocks file share
      }
    }

    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div className="flex items-center gap-1.5">
      {!isRecording ? (
        <button
          type="button"
          onClick={startViralRecording}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-red-600/90 hover:bg-red-500 border border-red-300 text-white text-[10px] font-bold tracking-wider uppercase shadow-[0_0_12px_rgba(239,68,68,0.6)] active:scale-95 transition cursor-pointer"
          title="Compone video 9:16 (540x960 @ 30FPS fluido) con mapa, radar y marco VHS"
        >
          <Circle className="w-3 h-3 fill-white text-white animate-pulse" />
          <Video className="w-3.5 h-3.5" />
          <span>GRABAR PARA REDES</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={stopViralRecording}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-red-500 border-2 border-yellow-300 text-white text-[10px] font-bold uppercase animate-pulse cursor-pointer"
        >
          <Square className="w-3 h-3 fill-white" />
          <span>REC 00:{String(secondsElapsed).padStart(2, "0")}/{MAX_RECORDING_SECONDS}s (PARAR)</span>
        </button>
      )}

      {recordedBlob && !isRecording && (
        <button
          type="button"
          onClick={shareOrDownloadClip}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 border border-emerald-200 text-slate-950 text-[10px] font-extrabold uppercase shadow-lg cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Compartir 9:16</span>
          <Download className="w-3 h-3 opacity-75" />
        </button>
      )}
    </div>
  );
}

