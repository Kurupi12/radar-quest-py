"use client";

import { useEffect, useRef } from "react";
import type { ThermalState } from "@/types/radar";
import { arcadeHardware } from "@/lib/hardware/arcadeHardware";
import {
  calculateBearingDegrees,
  getCardinalDirection4,
  calculateHaversineMeters,
  type CardinalDirection4,
} from "@/lib/radar/geo";

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
  speedKmh?: number;
  coords?: { lat: number; lng: number };
  primaryColor?: string;
  secondaryColor?: string;
  active?: boolean;
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

  if (inVehicle) {
    // Ground shadow for cyber car
    ctx.fillStyle = "rgba(10, 4, 24, 0.78)";
    ctx.fillRect(cx - 10, cy + 12, 20, 4);

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
  speedKmh = 0,
  coords,
  primaryColor = "#a855f7",
  secondaryColor = "#00f0ff",
  active = true,
  onCanvasReady,
}: RadarCanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const walkImagesRef = useRef<HTMLImageElement[]>([]);
  const jumpImagesRef = useRef<HTMLImageElement[]>([]);
  const directionalImagesRef = useRef<{
    south: HTMLImageElement | null;
    north: HTMLImageElement | null;
    east: HTMLImageElement | null;
    west: HTMLImageElement | null;
  }>({ south: null, north: null, east: null, west: null });
  const flamesImgRef = useRef<HTMLImageElement | null>(null);
  const onCanvasReadyRef = useRef(onCanvasReady);

  useEffect(() => {
    onCanvasReadyRef.current = onCanvasReady;
  }, [onCanvasReady]);

  const stateRef = useRef({
    thermalState,
    inVehicleMode,
    dangerAlertActive,
    speedKmh,
    coords,
    primaryColor,
    secondaryColor,
    active,
  });

  // Preload PixelLab walk & jump celebration animation frames, directional idle poses & thermal flames spritesheet
  useEffect(() => {
    const walkImages: HTMLImageElement[] = [];
    for (let i = 0; i < 9; i++) {
      const img = new Image();
      img.src = `/sprites/walk_south/frame_${i}.png`;
      walkImages.push(img);
    }
    walkImagesRef.current = walkImages;

    const jumpImages: HTMLImageElement[] = [];
    for (let i = 0; i < 9; i++) {
      const img = new Image();
      img.src = `/sprites/jump_south/frame_${i}.png`;
      jumpImages.push(img);
    }
    jumpImagesRef.current = jumpImages;

    const loadImg = (src: string) => {
      const img = new Image();
      img.src = src;
      return img;
    };
    directionalImagesRef.current = {
      south: loadImg("/sprites/hunter_south.png"),
      north: loadImg("/sprites/hunter_north.png"),
      east: loadImg("/sprites/hunter_east.png"),
      west: loadImg("/sprites/hunter_west.png"),
    };

    const flamesImg = new Image();
    flamesImg.src = "/sprites/flames/flames_sheet.png";
    flamesImgRef.current = flamesImg;
  }, []);

  stateRef.current = {
    thermalState,
    inVehicleMode,
    dangerAlertActive,
    speedKmh,
    coords,
    primaryColor,
    secondaryColor,
    active,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    if (onCanvasReadyRef.current) {
      onCanvasReadyRef.current(canvas);
    }

    let animId = 0;
    let wavePhase = 0;
    let tick = 0;
    let walkStepPhase = 0;
    let facingDirection: CardinalDirection4 = "south";
    let lastCoords = { lat: 0, lng: 0 };
    const particles: FireParticle[] = [];

    // Estado del ciclo estocástico de frizado por frío (espaciado generoso para evitar fatiga)
    let freezeState: "NORMAL" | "FROZEN" = "NORMAL";
    let freezeStartTick = 0;
    let freezeDurationTicks = 100;
    let nextFreezeIntervalTicks = 900; // Primer congelamiento ocurre tras ~15 segundos de exploración en frío
    let lastCycleEndTick = 0;
    let frozenFrameIdx = 0;

    const renderFrame = () => {
      tick += 1;
      const {
        thermalState: currentThermal,
        inVehicleMode: vehicle,
        dangerAlertActive: danger,
        speedKmh: currentSpeedKmh,
        coords: currentCoords,
        primaryColor: pColor,
        secondaryColor: sColor,
        active: isOverlayActive,
      } = stateRef.current;

      const cx = LOGICAL_WIDTH / 2;
      const cy = LOGICAL_HEIGHT / 2;

      // Detección de rumbo y orientación 4D del cazador a partir del movimiento GPS
      if (currentCoords && currentCoords.lat && currentCoords.lng) {
        if (lastCoords.lat === 0 && lastCoords.lng === 0) {
          lastCoords = { lat: currentCoords.lat, lng: currentCoords.lng };
        } else {
          const distMoved = calculateHaversineMeters(
            lastCoords.lat,
            lastCoords.lng,
            currentCoords.lat,
            currentCoords.lng
          );
          // Si el jugador se desplazó al menos 1.5 metros, actualizamos su rumbo cardinal
          if (distMoved >= 1.5) {
            const bearing = calculateBearingDegrees(
              lastCoords.lat,
              lastCoords.lng,
              currentCoords.lat,
              currentCoords.lng
            );
            facingDirection = getCardinalDirection4(bearing);
            lastCoords = { lat: currentCoords.lat, lng: currentCoords.lng };
          }
        }
      }

      // Estado de movimiento real (caminando vs parado)
      const isMoving = (currentSpeedKmh ?? 0) >= 1.4 && !vehicle;
      if (isMoving) {
        const speedFactor = Math.min(
          Math.max((currentSpeedKmh || 3) / 3.6, 0.6),
          2.2
        );
        walkStepPhase += 0.14 * speedFactor;
      } else {
        walkStepPhase = 0;
      }

      // Se considera estado frío tanto en CONGELADO como en FUERA DE ZONA (lejanía del tesoro)
      // Sólo se activa si el overlay está activo (el jugador ya superó el preloader de inicio)
      const isCold =
        Boolean(isOverlayActive) &&
        (currentThermal === "CONGELADO" || currentThermal === "FUERA DE ZONA") &&
        !vehicle;

      if (isCold) {
        if (freezeState === "NORMAL") {
          if (tick - lastCycleEndTick >= nextFreezeIntervalTicks) {
            freezeState = "FROZEN";
            freezeStartTick = tick;
            // Duración del frizado: 1.5s a 2.0s (90 a 120 frames a 60fps)
            freezeDurationTicks = Math.floor(90 + Math.random() * 30);
            frozenFrameIdx = Math.floor(tick / 6) % 9;
            arcadeHardware.playFreezeSound();
          }
        } else if (freezeState === "FROZEN") {
          if (tick - freezeStartTick >= freezeDurationTicks) {
            freezeState = "NORMAL";
            lastCycleEndTick = tick;
            // Próximo ciclo en intervalo mucho más espaciado: entre 30s y 65s (1.800 a 3.900 frames a 60fps)
            nextFreezeIntervalTicks = Math.floor(1800 + Math.random() * 2100);

            // Explosión de esquirlas de hielo en abanico al descongelarse
            for (let k = 0; k < 14; k++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 1.2 + Math.random() * 2.5;
              particles.push({
                x: cx + (Math.random() - 0.5) * 16,
                y: cy + (Math.random() - 0.5) * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed + 0.8,
                size: Math.random() > 0.4 ? 3 : 2,
                life: 0,
                maxLife: 22 + Math.floor(Math.random() * 16),
                color: Math.random() > 0.5 ? "#bae6fd" : "#ffffff",
              });
            }
          }
        }
      } else {
        if (freezeState === "FROZEN") {
          freezeState = "NORMAL";
          lastCycleEndTick = tick;
        }
        // Al salir y volver a entrar a zona fría, esperar al menos 30s a 50s
        nextFreezeIntervalTicks = Math.floor(1800 + Math.random() * 1200);
      }

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

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

      // 3.5. Render PixelLab 16-bit Thermal Flame Aura when HOT or BURNING
      if (
        (currentThermal === "CALIENTE" || currentThermal === "QUEMANDO") &&
        !vehicle
      ) {
        const flamesImg = flamesImgRef.current;
        if (flamesImg && flamesImg.complete && flamesImg.naturalWidth > 0) {
          const flameFrameIdx = Math.floor(tick / 5) % 8;
          const sx = flameFrameIdx * 68;
          const sy = 0;
          const sw = 68;
          const sh = 103;

          const isBurning = currentThermal === "QUEMANDO";
          const flameW = isBurning ? 64 : 52;
          const flameH = Math.round(flameW * (103 / 68));
          // Pivot at character feet: (cx, cy + 13)
          const flameX = Math.round(cx - flameW / 2);
          const flameY = Math.round(cy + 13 - flameH * 0.854);

          ctx.save();
          ctx.globalAlpha = isBurning ? 0.95 : 0.78;
          ctx.drawImage(
            flamesImg,
            sx,
            sy,
            sw,
            sh,
            flameX,
            flameY,
            flameW,
            flameH
          );
          ctx.restore();
        }
      }

      // 4. Draw 16-bit Hunter Sprite (Jump Celebration when QUEMANDO, Walk when moving, Idle when stopped, Frozen Shiver, or Cyber Car)
      const isBurning = currentThermal === "QUEMANDO";
      const isFrozen = freezeState === "FROZEN";

      // Temblor involuntario de frío a alta frecuencia (shiver de 1-2px)
      const shiverX = isFrozen ? (tick % 4 < 2 ? 1 : -1) : 0;
      const shiverY = isFrozen ? (tick % 6 < 3 ? 0 : 1) : 0;

      if (!vehicle) {
        const drawSize = isBurning ? 48 : 46;
        const targetX = Math.round(cx - drawSize / 2 + shiverX);
        const targetY = Math.round(cy - drawSize / 2 - 1 + shiverY);

        if (isBurning) {
          // Celebración por cercanía crítica al tesoro
          const jumpList = jumpImagesRef.current;
          const jumpIdx = Math.floor(tick / 5) % (jumpList.length || 9);
          const jumpImg = jumpList[jumpIdx];
          if (jumpImg && jumpImg.complete && jumpImg.naturalWidth > 0) {
            ctx.drawImage(jumpImg, targetX, targetY, drawSize, drawSize);
          }
        } else if (isMoving) {
          // ESTADO: CAMINANDO (animación de pasos activa con cadencia según velocidad)
          const walkList = walkImagesRef.current;
          const walkFrame = Math.floor(walkStepPhase) % (walkList.length || 9);
          const stepBob = Math.sin(walkStepPhase * Math.PI * 2) > 0 ? -1 : 0;

          if (facingDirection === "south") {
            const walkImg = walkList[walkFrame];
            if (walkImg && walkImg.complete && walkImg.naturalWidth > 0) {
              ctx.drawImage(walkImg, targetX, targetY, drawSize, drawSize);
            }
          } else if (facingDirection === "west") {
            const westImg = directionalImagesRef.current.west;
            if (westImg && westImg.complete && westImg.naturalWidth > 0) {
              ctx.drawImage(westImg, targetX, targetY + stepBob, drawSize, drawSize);
            } else {
              const walkImg = walkList[walkFrame];
              if (walkImg && walkImg.complete && walkImg.naturalWidth > 0) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.scale(-1, 1);
                ctx.drawImage(walkImg, -drawSize / 2, -drawSize / 2 - 1, drawSize, drawSize);
                ctx.restore();
              }
            }
          } else if (facingDirection === "east") {
            const eastImg = directionalImagesRef.current.east;
            if (eastImg && eastImg.complete && eastImg.naturalWidth > 0) {
              ctx.drawImage(eastImg, targetX, targetY + stepBob, drawSize, drawSize);
            }
          } else {
            // north
            const northImg = directionalImagesRef.current.north;
            if (northImg && northImg.complete && northImg.naturalWidth > 0) {
              ctx.drawImage(northImg, targetX, targetY + stepBob, drawSize, drawSize);
            }
          }
        } else {
          // ESTADO: QUIETO (IDLE) - Pies firmes en el suelo, micro-respiración orgánica
          const idleBob = Math.sin(tick * 0.08) > 0.65 ? -1 : 0;
          const idleImg =
            directionalImagesRef.current[facingDirection] ||
            directionalImagesRef.current.south;

          if (idleImg && idleImg.complete && idleImg.naturalWidth > 0) {
            ctx.drawImage(idleImg, targetX, targetY + idleBob, drawSize, drawSize);
          } else {
            const defaultImg = walkImagesRef.current[0];
            if (defaultImg && defaultImg.complete && defaultImg.naturalWidth > 0) {
              ctx.drawImage(defaultImg, targetX, targetY + idleBob, drawSize, drawSize);
            }
          }
        }

        // EFECTO VISUAL: BLOQUE DE HIELO TRANSLÚCIDO 16-BIT & ALIENTO GÉLIDO
        if (isFrozen) {
          ctx.save();
          const iceW = 38;
          const iceH = 46;
          const iceX = Math.round(cx - iceW / 2 + shiverX);
          const iceY = Math.round(cy - iceH / 2 + 1 + shiverY);

          // Prisma de hielo cian/azul gélido translúcido
          ctx.fillStyle = "rgba(186, 230, 253, 0.42)";
          ctx.fillRect(iceX, iceY, iceW, iceH);

          // Aristas brillantes de cristal de hielo (blanco puro)
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.fillRect(iceX + 2, iceY + 2, iceW - 4, 2);
          ctx.fillRect(iceX + 2, iceY + 2, 2, iceH - 4);

          // Aristas de refracción oscura
          ctx.fillStyle = "rgba(14, 116, 144, 0.75)";
          ctx.fillRect(iceX + iceW - 3, iceY + 2, 2, iceH - 4);
          ctx.fillRect(iceX + 2, iceY + iceH - 3, iceW - 4, 2);

          // Destello diagonal pixel-art (glint)
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(iceX + 7, iceY + 7, 4, 2);
          ctx.fillRect(iceX + 8, iceY + 9, 2, 4);

          // Estalagmitas / carámbanos de escarcha en la base y cabeza
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(iceX + 4, iceY + iceH, 3, 4);
          ctx.fillRect(iceX + 16, iceY + iceH, 4, 6);
          ctx.fillRect(iceX + 29, iceY + iceH, 3, 4);

          ctx.fillStyle = "#bae6fd";
          ctx.fillRect(iceX + 9, iceY - 4, 4, 4);
          ctx.fillRect(iceX + 23, iceY - 5, 5, 5);

          // Rótulo cómico pixel-art flotando sobre la cabeza del cazador
          ctx.fillStyle = "#0284c7";
          ctx.font = "900 12px monospace";
          ctx.textAlign = "center";
          ctx.fillText("¡BRRR!", cx + shiverX + 22, cy - 20 + shiverY);
          ctx.fillStyle = "#ffffff";
          ctx.fillText("¡BRRR!", cx + shiverX + 21, cy - 21 + shiverY);

          ctx.restore();

          // Partículas de aliento gélido / vapor frío emitidas por la boca
          if (Math.random() > 0.35) {
            particles.push({
              x: cx + 2 + shiverX,
              y: cy - 7 + shiverY,
              vx: (Math.random() - 0.5) * 0.4 + 0.35,
              vy: -0.6 - Math.random() * 0.8,
              size: Math.random() > 0.5 ? 3 : 2,
              life: 0,
              maxLife: 24 + Math.floor(Math.random() * 16),
              color: Math.random() > 0.35 ? "#bae6fd" : "#ffffff",
            });
          }
        }
      } else {
        // Fallback procedural sprite or cyber vehicle
        const spriteFrame = Math.floor(tick / 18);
        drawHunterSprite16Bit(
          ctx,
          cx + shiverX,
          cy + shiverY,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={LOGICAL_WIDTH}
      height={LOGICAL_HEIGHT}
      className="pixelated pointer-events-none absolute inset-0 w-full h-full z-10"
    />
  );
}

