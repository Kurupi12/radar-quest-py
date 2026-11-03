"use client";

import { useEffect, useRef } from "react";
import type { ThermalState } from "@/types/radar";

interface FireParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

interface RadarCanvasOverlayProps {
  thermalState: ThermalState;
  inVehicleMode: boolean;
  dangerAlertActive: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

const LOGICAL_WIDTH = 360;
const LOGICAL_HEIGHT = 640;

function getThermalColors(
  state: ThermalState,
  primaryColor: string
): {
  ring: string;
  core: string;
  speed: number;
  ringCount: number;
  firePalette: string[];
} {
  switch (state) {
    case "QUEMANDO":
      return {
        ring: "#ff0055",
        core: "#fde047",
        speed: 2.6,
        ringCount: 5,
        firePalette: ["#ff0055", "#fb923c", "#fde047", "#ffffff"],
      };
    case "CALIENTE":
      return {
        ring: "#fb923c",
        core: "#facc15",
        speed: 1.75,
        ringCount: 4,
        firePalette: ["#ea580c", "#fb923c", "#facc15"],
      };
    case "TIBIO":
      return {
        ring: "#facc15",
        core: "#fef08a",
        speed: 1.15,
        ringCount: 3,
        firePalette: [],
      };
    case "CONGELADO":
      return {
        ring: "#38bdf8",
        core: "#bae6fd",
        speed: 0.65,
        ringCount: 3,
        firePalette: [],
      };
    case "TELEPORT_ANOMALY":
      return {
        ring: "#ef4444",
        core: "#ff007f",
        speed: 3.2,
        ringCount: 4,
        firePalette: ["#ef4444", "#a855f7"],
      };
    case "FUERA DE ZONA":
    default:
      return {
        ring: primaryColor || "#a855f7",
        core: "#c084fc",
        speed: 0.45,
        ringCount: 2,
        firePalette: [],
      };
  }
}

/**
 * Draws a crisp pixelated circle using Bresenham-like stepped blocks (pixelScale = 2px)
 */
function drawPixelCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha: number
) {
  if (radius < 4 || alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color;

  const step = Math.max(0.035, 3.2 / radius);
  const pxSize = 3;
  for (let angle = 0; angle < Math.PI * 2; angle += step) {
    const x = Math.round((cx + Math.cos(angle) * radius) / pxSize) * pxSize;
    const y = Math.round((cy + Math.sin(angle) * radius) / pxSize) * pxSize;
    ctx.fillRect(x, y, pxSize, pxSize);
  }
  ctx.restore();
}

/**
 * Draws a 16-bit Pixel Art Hunter Sprite (or Neon Pixel Vehicle when inVehicleMode)
 */
function drawHunterSprite16Bit(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  frame: number,
  inVehicle: boolean,
  visorColor: string,
  suitColor: string
) {
  const s = 2; // 2x logical pixel size on 360x640 grid
  const bob = frame % 2 === 0 ? 0 : -2;

  ctx.save();
  // Ground shadow
  ctx.fillStyle = "rgba(10, 4, 24, 0.78)";
  ctx.fillRect(cx - 10, cy + 12, 20, 4);

  if (inVehicle) {
    // 16-bit Cyber Car Sprite
    const x0 = cx - 14;
    const y0 = cy - 8 + bob;
    ctx.fillStyle = "#090314";
    ctx.fillRect(x0 - 2, y0 - 2, 32, 20);
    // Body
    ctx.fillStyle = suitColor;
    ctx.fillRect(x0, y0 + 4, 28, 10);
    ctx.fillRect(x0 + 6, y0, 16, 6);
    // Neon windshield
    ctx.fillStyle = visorColor;
    ctx.fillRect(x0 + 8, y0 + 2, 12, 4);
    // Headlights
    ctx.fillStyle = "#fde047";
    ctx.fillRect(x0 + 26, y0 + 6, 3, 4);
    // Wheels
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x0 + 3, y0 + 12, 6, 5);
    ctx.fillRect(x0 + 19, y0 + 12, 6, 5);
    ctx.restore();
    return;
  }

  // 16-bit Urban Hunter Explorer Sprite
  const ox = cx - 6 * s;
  const oy = cy - 8 * s + bob;

  // Outline / Helmet base
  ctx.fillStyle = "#090314";
  ctx.fillRect(ox + 2 * s, oy, 8 * s, 14 * s);

  // Hood / Helmet
  ctx.fillStyle = suitColor;
  ctx.fillRect(ox + 3 * s, oy + 1 * s, 6 * s, 5 * s);

  // Glowing Cyber Visor
  ctx.fillStyle = visorColor;
  ctx.fillRect(ox + 4 * s, oy + 3 * s, 5 * s, 2 * s);

  // Jacket Torso + Radar Backpack
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(ox + 3 * s, oy + 6 * s, 6 * s, 4 * s);
  ctx.fillStyle = suitColor;
  ctx.fillRect(ox + 4 * s, oy + 7 * s, 4 * s, 3 * s);

  // Antenna blinking tip
  ctx.fillStyle = frame % 2 === 0 ? "#ff0055" : "#fde047";
  ctx.fillRect(ox + 2 * s, oy - 2 * s, 2 * s, 2 * s);

  // Animated 16-bit Legs
  ctx.fillStyle = "#38bdf8";
  if (frame % 2 === 0) {
    ctx.fillRect(ox + 3 * s, oy + 10 * s, 2 * s, 3 * s);
    ctx.fillRect(ox + 7 * s, oy + 10 * s, 2 * s, 2 * s);
  } else {
    ctx.fillRect(ox + 3 * s, oy + 10 * s, 2 * s, 2 * s);
    ctx.fillRect(ox + 7 * s, oy + 10 * s, 2 * s, 3 * s);
  }

  ctx.restore();
}

export function RadarCanvasOverlay({
  thermalState,
  inVehicleMode,
  dangerAlertActive,
  primaryColor = "#a855f7",
  secondaryColor = "#00f0ff",
  onCanvasReady,
}: RadarCanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const walkImagesRef = useRef<HTMLImageElement[]>([]);
  const stateRef = useRef({
    thermalState,
    inVehicleMode,
    dangerAlertActive,
    primaryColor,
    secondaryColor,
  });

  // Preload PixelLab walk animation frames (frame_0.png to frame_8.png)
  useEffect(() => {
    const images: HTMLImageElement[] = [];
    for (let i = 0; i < 9; i++) {
      const img = new Image();
      img.src = `/sprites/walk_south/frame_${i}.png`;
      images.push(img);
    }
    walkImagesRef.current = images;
  }, []);

  stateRef.current = {
    thermalState,
    inVehicleMode,
    dangerAlertActive,
    primaryColor,
    secondaryColor,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    if (onCanvasReady) {
      onCanvasReady(canvas);
    }

    let animId = 0;
    let wavePhase = 0;
    let tick = 0;
    const particles: FireParticle[] = [];

    const renderFrame = () => {
      tick += 1;
      const {
        thermalState: currentThermal,
        inVehicleMode: vehicle,
        dangerAlertActive: danger,
        primaryColor: pColor,
        secondaryColor: sColor,
      } = stateRef.current;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      const cx = LOGICAL_WIDTH / 2;
      const cy = LOGICAL_HEIGHT / 2;

      const cfg = getThermalColors(currentThermal, pColor);
      wavePhase = (wavePhase + cfg.speed) % 150;

      // 1. Subtle Radar Crosshair Grid
      ctx.save();
      ctx.fillStyle = "rgba(0, 240, 255, 0.14)";
      for (let x = 20; x < LOGICAL_WIDTH - 20; x += 8) {
        ctx.fillRect(x, cy, 3, 1);
      }
      for (let y = 90; y < LOGICAL_HEIGHT - 90; y += 8) {
        ctx.fillRect(cx, y, 1, 3);
      }
      ctx.restore();

      // 2. Concentric Thermal Waves
      const maxRadius = 150;
      for (let i = 0; i < cfg.ringCount; i++) {
        const r = (wavePhase + (i * maxRadius) / cfg.ringCount) % maxRadius;
        const alpha = (1 - r / maxRadius) * 0.9;
        drawPixelCircle(ctx, cx, cy, r, cfg.ring, alpha);
      }

      // Inner pulsing core ring
      const corePulse = 20 + Math.sin(tick * 0.12) * 4;
      drawPixelCircle(ctx, cx, cy, corePulse, cfg.core, 0.72);

      // 3. Spawn & Render Pixel Fire / Heat Embers at 60 FPS
      if (cfg.firePalette.length > 0) {
        const spawnCount = currentThermal === "QUEMANDO" ? 3 : 1;
        for (let s = 0; s < spawnCount; s++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 10 + Math.random() * (currentThermal === "QUEMANDO" ? 44 : 26);
          particles.push({
            x: cx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -0.9 - Math.random() * 1.8,
            size: Math.random() > 0.45 ? 4 : 3,
            life: 0,
            maxLife: 28 + Math.floor(Math.random() * 24),
            color:
              cfg.firePalette[
                Math.floor(Math.random() * cfg.firePalette.length)
              ],
          });
        }
      }

      for (let p = particles.length - 1; p >= 0; p--) {
        const pt = particles[p];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life += 1;

        if (pt.life >= pt.maxLife) {
          particles.splice(p, 1);
          continue;
        }

        const lifeRatio = 1 - pt.life / pt.maxLife;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = lifeRatio;
        ctx.fillRect(
          Math.round(pt.x / 2) * 2,
          Math.round(pt.y / 2) * 2,
          pt.size,
          pt.size
        );
      }
      ctx.globalAlpha = 1;

      // 4. Draw 16-bit Hunter Sprite (PixelLab Walk Animation or Cyber Car)
      const walkImages = walkImagesRef.current;
      const currentWalkIdx = Math.floor(tick / 6) % 9;
      const walkImg = walkImages[currentWalkIdx];

      if (!vehicle && walkImg && walkImg.complete && walkImg.naturalWidth > 0) {
        const drawSize = 46;
        // Ground shadow
        ctx.fillStyle = "rgba(10, 4, 24, 0.72)";
        ctx.fillRect(cx - 11, cy + 13, 22, 5);

        // Render PixelLab 16-bit animated hunter
        ctx.drawImage(
          walkImg,
          Math.round(cx - drawSize / 2),
          Math.round(cy - drawSize / 2 - 1),
          drawSize,
          drawSize
        );
      } else {
        // Fallback procedural sprite or cyber vehicle
        const spriteFrame = Math.floor(tick / 18);
        drawHunterSprite16Bit(
          ctx,
          cx,
          cy,
          spriteFrame,
          vehicle,
          sColor,
          pColor
        );
      }

      // 5. Rival Danger Red Strobe Border on Canvas
      if (danger && Math.floor(tick / 10) % 2 === 0) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, LOGICAL_WIDTH - 6, LOGICAL_HEIGHT - 6);
      }

      animId = window.requestAnimationFrame(renderFrame);
    };

    animId = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(animId);
  }, [onCanvasReady]);

  return (
    <canvas
      ref={canvasRef}
      width={LOGICAL_WIDTH}
      height={LOGICAL_HEIGHT}
      className="pixelated pointer-events-none absolute inset-0 w-full h-full z-10"
    />
  );
}

