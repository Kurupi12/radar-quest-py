"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
} from "maplibre-gl";

// Fix for Next.js / Turbopack Worker loading
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

export interface LiveHunterPin {
  hunterId: string;
  alias: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  inVehicleMode: boolean;
  thermalState: string;
}

export interface MapHeatmapPoint {
  lat: number;
  lng: number;
  weight?: number;
}

interface ArcadeMapProps {
  centerLat: number;
  centerLng: number;
  zoom?: number;
  primaryColor?: string;
  secondaryColor?: string;
  interactive?: boolean;
  /** Mode: 'player' (follows hunter), 'admin-pin' (click/drag secret treasure), 'admin-live' (Command Center) */
  mode?: "player" | "admin-pin" | "admin-live";
  secretPin?: { lat: number; lng: number } | null;
  liveHunters?: LiveHunterPin[];
  heatmapPoints?: MapHeatmapPoint[];
  showHeatmap?: boolean;
  onSelectCoord?: (lat: number, lng: number) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

const CARTO_DARK_VECTOR_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const HEATMAP_SOURCE_ID = "hunter-pings-heat";
const HEATMAP_LAYER_ID = "hunter-pings-heatmap";
const HEATMAP_CORE_LAYER_ID = "hunter-pings-cores";

const TARGET_SVG_HTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;

const CAR_SVG_HTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;

const WALKER_SVG_HTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`;

function buildHeatmapGeoJson(points: MapHeatmapPoint[]) {
  return {
    type: "FeatureCollection" as const,
    features: points.map((pt) => ({
      type: "Feature" as const,
      properties: {
        weight: pt.weight ?? 0.65,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [pt.lng, pt.lat] as [number, number],
      },
    })),
  };
}

function syncHeatmapOnMap(
  map: MapLibreMap,
  points: MapHeatmapPoint[],
  visible: boolean
) {
  if (!map.isStyleLoaded()) return;

  const data = buildHeatmapGeoJson(points);
  const existingSource = map.getSource(HEATMAP_SOURCE_ID) as
    | GeoJSONSource
    | undefined;

  if (!existingSource) {
    map.addSource(HEATMAP_SOURCE_ID, {
      type: "geojson",
      data,
    });

    map.addLayer({
      id: HEATMAP_LAYER_ID,
      type: "heatmap",
      source: HEATMAP_SOURCE_ID,
      maxzoom: 19,
      layout: {
        visibility: visible ? "visible" : "none",
      },
      paint: {
        "heatmap-weight": ["coalesce", ["get", "weight"], 0.65],
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          1.1,
          15,
          2.2,
          18,
          3.0,
        ],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0, 0, 0, 0)",
          0.18,
          "rgba(0, 240, 255, 0.45)",
          0.42,
          "rgba(168, 85, 247, 0.72)",
          0.66,
          "rgba(251, 146, 60, 0.88)",
          0.86,
          "rgba(250, 204, 21, 0.95)",
          1,
          "rgba(255, 0, 85, 1)",
        ],
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          14,
          15,
          32,
          18,
          50,
        ],
        "heatmap-opacity": 0.86,
      },
    });

    map.addLayer({
      id: HEATMAP_CORE_LAYER_ID,
      type: "circle",
      source: HEATMAP_SOURCE_ID,
      minzoom: 14,
      layout: {
        visibility: visible ? "visible" : "none",
      },
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          2.5,
          18,
          5.5,
        ],
        "circle-color": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "weight"], 0.65],
          0.2,
          "#00f0ff",
          0.55,
          "#a855f7",
          0.8,
          "#fb923c",
          1,
          "#ff0055",
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1,
        "circle-opacity": 0.78,
      },
    });
  } else {
    existingSource.setData(data);
    const vis = visible ? "visible" : "none";
    if (map.getLayer(HEATMAP_LAYER_ID)) {
      map.setLayoutProperty(HEATMAP_LAYER_ID, "visibility", vis);
    }
    if (map.getLayer(HEATMAP_CORE_LAYER_ID)) {
      map.setLayoutProperty(HEATMAP_CORE_LAYER_ID, "visibility", vis);
    }
  }
}

export function ArcadeMap({
  centerLat,
  centerLng,
  zoom = 16,
  primaryColor = "#a855f7",
  secondaryColor = "#00f0ff",
  interactive = true,
  mode = "player",
  secretPin = null,
  liveHunters = [],
  heatmapPoints = [],
  showHeatmap = false,
  onSelectCoord,
  onCanvasReady,
}: ArcadeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const secretMarkerRef = useRef<Marker | null>(null);
  const hunterMarkersRef = useRef<Marker[]>([]);
  const onSelectCoordRef = useRef(onSelectCoord);
  onSelectCoordRef.current = onSelectCoord;

  const heatmapStateRef = useRef({ heatmapPoints, showHeatmap });
  heatmapStateRef.current = { heatmapPoints, showHeatmap };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: CARTO_DARK_VECTOR_STYLE,
      center: [centerLng, centerLat],
      zoom,
      pitch: mode === "player" ? 22 : 0,
      attributionControl: { compact: true },
      interactive,
      canvasContextAttributes: {
        preserveDrawingBuffer: true,
      },
    });

    mapRef.current = map;

    const applyArcade16BitPalette = () => {
      const style = map.getStyle();
      if (!style || !style.layers) return;

      for (const layer of style.layers) {
        const id = layer.id.toLowerCase();

        // 1. Hide rival commercial POIs completely while preserving street & city labels
        if (
          id.includes("poi") ||
          id.includes("aeroway") ||
          id.includes("housenumber")
        ) {
          try {
            map.setLayoutProperty(layer.id, "visibility", "none");
          } catch {}
          continue;
        }

        // 2. High-Contrast Multicolor Geographical Elements (Tactical Dark Cyberpunk Palette)
        if (layer.type === "background") {
          try {
            map.setPaintProperty(layer.id, "background-color", "#080d1a");
          } catch {}
        }

        if (layer.type === "fill") {
          if (id.includes("water")) {
            // Rivers, Lakes & Bays: Electric Cobalt / Deep Cyan
            try {
              map.setPaintProperty(layer.id, "fill-color", "#0284c7");
              map.setPaintProperty(layer.id, "fill-opacity", 0.9);
            } catch {}
          } else if (
            id.includes("park") ||
            id.includes("garden") ||
            id.includes("grass") ||
            id.includes("pitch") ||
            id.includes("forest") ||
            id.includes("wood") ||
            id.includes("leisure") ||
            id.includes("recreation")
          ) {
            // Authentic Green Spaces (Parks, Plazas & Sports Grounds): Deep Cyber Emerald
            try {
              map.setPaintProperty(layer.id, "fill-color", "#065f46");
              map.setPaintProperty(layer.id, "fill-opacity", 0.85);
            } catch {}
          } else if (
            id.includes("landuse") ||
            id.includes("landcover") ||
            id.includes("residential") ||
            id.includes("commercial") ||
            id.includes("industrial")
          ) {
            // Urban Blocks & Zoned Ground: Subtle Dark Slate (prevents green flood over entire city)
            try {
              map.setPaintProperty(layer.id, "fill-color", "#0f172a");
              map.setPaintProperty(layer.id, "fill-opacity", 0.75);
            } catch {}
          } else if (id.includes("building")) {
            // 16-Bit Architectural Buildings: Crisp Slate Steel with Clean Borders
            try {
              map.setPaintProperty(layer.id, "fill-color", "#1e293b");
              map.setPaintProperty(layer.id, "fill-outline-color", "#334155");
              map.setPaintProperty(layer.id, "fill-opacity", 0.95);
            } catch {}
          }
        }

        // 3. High-Contrast Vivid Street Network
        if (layer.type === "line") {
          if (id.includes("water")) {
            try {
              map.setPaintProperty(layer.id, "line-color", "#38bdf8");
              map.setPaintProperty(layer.id, "line-width", 2);
            } catch {}
          } else if (
            id.includes("road") ||
            id.includes("transportation") ||
            id.includes("bridge") ||
            id.includes("tunnel") ||
            id.includes("rail")
          ) {
            const isHighSpeed =
              id.includes("motorway") ||
              id.includes("trunk") ||
              id.includes("_mot_") ||
              id.includes("_trunk_");
            const isPrimary =
              id.includes("primary") || id.includes("_pri_");
            const isSecondary =
              id.includes("secondary") || id.includes("_sec_");
            const isCasing = id.includes("case") || id.includes("casing");

            // Major Avenues: Amber Neon (#f59e0b)
            // Secondary Arteries: Warm Orange (#fb923c)
            // Residential Streets: Refined Tactical Cyan (#38bdf8)
            const streetColor = isHighSpeed
              ? "#f59e0b"
              : isPrimary
              ? "#fbbf24"
              : isSecondary
              ? "#fb923c"
              : "#38bdf8";

            try {
              map.setPaintProperty(
                layer.id,
                "line-color",
                isCasing ? "#020617" : streetColor
              );
              map.setPaintProperty(
                layer.id,
                "line-opacity",
                isCasing ? 0.95 : isHighSpeed || isPrimary ? 1.0 : 0.82
              );
            } catch {}
          } else if (id.includes("boundary")) {
            try {
              map.setPaintProperty(layer.id, "line-color", "#f43f5e");
            } catch {}
          }
        }

        // 4. Crisp High-Legibility Street & Place Labels
        if (layer.type === "symbol") {
          try {
            map.setPaintProperty(layer.id, "text-color", "#ffffff");
            map.setPaintProperty(layer.id, "text-halo-color", "#020617");
            map.setPaintProperty(layer.id, "text-halo-width", 2.2);
          } catch {}
        }
      }

      // 5. Mount HunterPing Heatmap Layer if enabled
      if (
        heatmapStateRef.current.showHeatmap ||
        heatmapStateRef.current.heatmapPoints.length > 0
      ) {
        try {
          syncHeatmapOnMap(
            map,
            heatmapStateRef.current.heatmapPoints,
            heatmapStateRef.current.showHeatmap
          );
        } catch {}
      }

      if (onCanvasReady) {
        onCanvasReady(map.getCanvas());
      }
    };

    map.on("style.load", applyArcade16BitPalette);
    map.on("load", applyArcade16BitPalette);

    if (mode === "admin-pin") {
      map.on("click", (ev: MapMouseEvent) => {
        if (onSelectCoordRef.current) {
          onSelectCoordRef.current(
            Number(ev.lngLat.lat.toFixed(6)),
            Number(ev.lngLat.lng.toFixed(6))
          );
        }
      });
    }

    return () => {
      secretMarkerRef.current?.remove();
      hunterMarkersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive Heatmap Layer Sync
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      syncHeatmapOnMap(map, heatmapPoints, showHeatmap);
    } catch {}
  }, [heatmapPoints, showHeatmap]);

  // Smooth pan when centerLat / centerLng updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = map.getCenter();
    const diff =
      Math.abs(current.lat - centerLat) + Math.abs(current.lng - centerLng);
    if (diff > 0.00002) {
      map.easeTo({
        center: [centerLng, centerLat],
        duration: diff > 0.05 ? 900 : 450,
      });
    }
  }, [centerLat, centerLng]);

  // Admin Secret Pin Marker (Draggable in admin-pin, static in admin-live)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!secretPin || mode === "player") {
      secretMarkerRef.current?.remove();
      secretMarkerRef.current = null;
      return;
    }

    if (!secretMarkerRef.current) {
      const el = document.createElement("div");
      el.className =
        "flex flex-col items-center justify-center cursor-pointer select-none";
      el.innerHTML = `
        <div style="background:#ff0055;border:2px solid #fff;box-shadow:0 0 18px #ff0055;padding:3px 7px;font-size:10px;font-weight:bold;color:#fff;border-radius:4px;margin-bottom:2px;white-space:nowrap;display:flex;align-items:center;">
          ${TARGET_SVG_HTML}<span>QR SECRETO (35m)</span>
        </div>
        <div style="width:18px;height:18px;background:#facc15;border:3px solid #140b29;transform:rotate(45deg);box-shadow:0 0 12px #facc15;"></div>
      `;

      const marker = new Marker({
        element: el,
        draggable: mode === "admin-pin",
      })
        .setLngLat([secretPin.lng, secretPin.lat])
        .addTo(map);

      if (mode === "admin-pin") {
        marker.on("dragend", () => {
          const pos = marker.getLngLat();
          onSelectCoordRef.current?.(
            Number(pos.lat.toFixed(6)),
            Number(pos.lng.toFixed(6))
          );
        });
      }

      secretMarkerRef.current = marker;
    } else {
      secretMarkerRef.current.setLngLat([secretPin.lng, secretPin.lat]);
    }
  }, [secretPin, mode]);

  // Live Hunters Tracking Pins for Command Center
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "admin-live") return;

    hunterMarkersRef.current.forEach((m) => m.remove());
    hunterMarkersRef.current = [];

    for (const h of liveHunters) {
      const el = document.createElement("div");
      const badgeColor =
        h.distanceMeters <= 35
          ? "#ef4444"
          : h.distanceMeters <= 160
          ? "#fb923c"
          : "#00f0ff";
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <span style="background:#140b29;border:1px solid ${badgeColor};color:#fff;font-size:10px;padding:2px 6px;border-radius:3px;white-space:nowrap;display:inline-flex;align-items:center;">
            ${h.inVehicleMode ? CAR_SVG_HTML : WALKER_SVG_HTML}<span>${h.alias} (${Math.round(
        h.distanceMeters
      )}m)</span>
          </span>
          <span style="width:10px;height:10px;background:${badgeColor};border:2px solid #fff;display:block;margin-top:2px;"></span>
        </div>
      `;
      const m = new Marker({ element: el })
        .setLngLat([h.lng, h.lat])
        .addTo(map);
      hunterMarkersRef.current.push(m);
    }
  }, [liveHunters, mode]);

  return (
    <div
      ref={containerRef}
      className="arcade-map-wrapper w-full h-full relative overflow-hidden bg-[#080d1a]"
    />
  );
}
