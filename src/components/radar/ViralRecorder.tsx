"use client";

import { useEffect, useRef, useState } from "react";
import { Circle, Download, Share2, Square, Video } from "lucide-react";
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
    };
  }, []);

  /**
   * Renders a single 9:16 story frame to the canvas
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

    // 4. VHS Scanlines
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    for (let y = 0; y < STORY_HEIGHT; y += 6) {
      ctx.fillRect(0, y, STORY_WIDTH, 2);
    }

    // Viewfinder brackets
    ctx.strokeStyle = b.secondaryColor || "#00f0ff";
    ctx.lineWidth = 4;
    const pad = 24;
    const corner = 45;
    ctx.beginPath();
    ctx.moveTo(pad, pad + corner);
    ctx.lineTo(pad, pad);
    ctx.lineTo(pad + corner, pad);

    ctx.moveTo(STORY_WIDTH - pad - corner, pad);
    ctx.lineTo(STORY_WIDTH - pad, pad);
    ctx.lineTo(STORY_WIDTH - pad, pad + corner);

    ctx.moveTo(pad, STORY_HEIGHT - pad - corner);
    ctx.lineTo(pad, STORY_HEIGHT - pad);
    ctx.lineTo(pad + corner, STORY_HEIGHT - pad);

    ctx.moveTo(STORY_WIDTH - pad - corner, STORY_HEIGHT - pad);
    ctx.lineTo(STORY_WIDTH - pad, STORY_HEIGHT - pad);
    ctx.lineTo(STORY_WIDTH - pad, STORY_HEIGHT - pad - corner);
    ctx.stroke();

    // 5. VHS Header
    ctx.fillStyle = "rgba(8, 13, 26, 0.9)";
    ctx.fillRect(36, 36, STORY_WIDTH - 72, 78);
    ctx.strokeStyle = b.primaryColor || "#a855f7";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(36, 36, STORY_WIDTH - 72, 78);

    if (Math.floor(frameTick / 15) % 2 === 0) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(60, 62, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px monospace";
    ctx.fillText("REC • VHS 16-BIT", 78, 68);

    const nowStr = new Date().toLocaleString("es-PY", { hour12: false });
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px monospace";
    ctx.fillText(`${nowStr} | CAZADOR: ${alias}`, 50, 96);

    // 6. Thermal Status HUD Banner
    const thermalColor =
      thermal === "QUEMANDO"
        ? "#ff0055"
        : thermal === "CALIENTE"
        ? "#fb923c"
        : thermal === "TIBIO"
        ? "#facc15"
        : "#38bdf8";

    ctx.fillStyle = "rgba(8, 13, 26, 0.92)";
    ctx.fillRect(48, 126, STORY_WIDTH - 96, 54);
    ctx.strokeStyle = thermalColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(48, 126, STORY_WIDTH - 96, 54);

    ctx.fillStyle = thermalColor;
    ctx.textAlign = "center";
    ctx.font = "bold 24px monospace";
    ctx.fillText(`RADAR: ${thermal}`, STORY_WIDTH / 2, 162);

    // 7. Bottom White-Label Brand Card
    ctx.fillStyle = "rgba(8, 13, 26, 0.94)";
    ctx.fillRect(36, STORY_HEIGHT - 146, STORY_WIDTH - 72, 106);
    ctx.strokeStyle = b.primaryColor || "#a855f7";
    ctx.lineWidth = 3;
    ctx.strokeRect(36, STORY_HEIGHT - 146, STORY_WIDTH - 72, 106);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px monospace";
    ctx.fillText(
      `${b.name.toUpperCase()}${b.requireAdult18 ? " (+18)" : ""}`,
      STORY_WIDTH / 2,
      STORY_HEIGHT - 110
    );

    ctx.fillStyle = b.secondaryColor || "#00f0ff";
    ctx.font = "15px monospace";
    ctx.fillText(
      m ? `${m.title} • ${m.city}` : "Caza del Tesoro QR • Paraguay",
      STORY_WIDTH / 2,
      STORY_HEIGHT - 82
    );

    ctx.fillStyle = "#fde047";
    ctx.font = "13px monospace";
    ctx.fillText(
      `${huntersCount} CAZADORES ACTIVOS • #RadarQuestPY`,
      STORY_WIDTH / 2,
      STORY_HEIGHT - 56
    );
    ctx.textAlign = "left";
  };

  /**
   * Start 15-second Video Recording
   */
  const startViralRecording = () => {
    setRecordedBlob(null);
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

    // Pick best supported MIME type
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

    // Clean base MIME without codec parameters for OS share sheet
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
      setIsRecording(false);
    };

    mediaRecorderRef.current = recorder;

    // CRITICAL: Call start() WITHOUT timeslice parameter!
    // Passing a timeslice (e.g. start(250)) corrupts WebM timestamps in Chromium to 3 seconds!
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

    // Clean MIME type strictly without parameters so Android Intent / ShareSheet accepts it
    const file = new File([recordedBlob], filename, { type: cleanMimeType });

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

  return (
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
          onClick={shareOrDownloadClip}
          className="px-3 py-2 rf-btn-emerald text-xs leading-none"
        >
          <span>COMPARTIR 15S</span>
        </button>
      )}
    </div>
  );
}
