"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Compass, LocateFixed, Moon, Sun } from "lucide-react";
import {
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
} from "maplibre-gl";
import type { RouteBonusBeacon } from "@/types/radar";
import {
  registerAllRpgTextures,
  setRpgTreesVisibility,
  syncRpgTreesOnMap,
} from "@/lib/radar/mapTextures";

// Active Map Visual Theme: 'rpg-16bit' (experimental textured pixel-art) vs 'cyberpunk-dark' (tactical dark theme)
export const CURRENT_MAP_THEME: "rpg-16bit" | "cyberpunk-dark" = "rpg-16bit";

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

export type ArcadeMapTheme = "rpg-16bit" | "cyberpunk-dark";

interface ArcadeMapProps {
  centerLat: number;
  centerLng: number;
  zoom?: number;
  primaryColor?: string;
  secondaryColor?: string;
  interactive?: boolean;
  /** Mode: 'player' (follows hunter), 'admin-pin' (click/drag secret treasure), 'admin-live' (Command Center) */
  mode?: "player" | "admin-pin" | "admin-live";
  theme?: ArcadeMapTheme;
  onThemeChange?: (nextTheme: ArcadeMapTheme) => void;
  bonusBeacons?: RouteBonusBeacon[];
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

const BEACON_DONE_SVG_HTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><polyline points="20 6 9 17 4 12"/></svg>`;

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
  theme,
  onThemeChange,
  bonusBeacons = [],
  secretPin = null,
  liveHunters = [],
  heatmapPoints = [],
  showHeatmap = false,
  onSelectCoord,
  onCanvasReady,
}: ArcadeMapProps) {
  const [internalTheme, setInternalTheme] = useState<ArcadeMapTheme>(CURRENT_MAP_THEME);
  const activeTheme: ArcadeMapTheme = theme || internalTheme;
  const activeThemeRef = useRef<ArcadeMapTheme>(activeTheme);
  activeThemeRef.current = activeTheme;

  const [isUserPanned, setIsUserPanned] = useState(false);
  const isUserPannedRef = useRef(false);
  const [compassEnabled, setCompassEnabled] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const secretMarkerRef = useRef<Marker | null>(null);
  const hunterMarkersRef = useRef<Marker[]>([]);
  const beaconMarkersRef = useRef<Marker[]>([]);
  const applyThemeFnRef = useRef<((next: ArcadeMapTheme) => void) | null>(null);
  const latestCoordsRef = useRef({ lat: centerLat, lng: centerLng });
  latestCoordsRef.current = { lat: centerLat, lng: centerLng };
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

    const applyCyberpunkDarkTheme = (mapInstance: MapLibreMap) => {
      const style = mapInstance.getStyle();
      if (!style || !style.layers) return;

      for (const layer of style.layers) {
        const id = layer.id.toLowerCase();

        if (
          id.includes("poi") ||
          id.includes("aeroway") ||
          id.includes("housenumber")
        ) {
          try {
            mapInstance.setLayoutProperty(layer.id, "visibility", "none");
          } catch {}
          continue;
        }

        if (layer.type === "background") {
          try {
            mapInstance.setPaintProperty(layer.id, "background-pattern", undefined);
            mapInstance.setPaintProperty(layer.id, "background-color", "#080d1a");
          } catch {}
        }

        if (layer.type === "fill") {
          try {
            mapInstance.setPaintProperty(layer.id, "fill-pattern", undefined);
            mapInstance.setPaintProperty(layer.id, "fill-translate", [0, 0]);
          } catch {}
          if (id.includes("water")) {
            try {
              mapInstance.setPaintProperty(layer.id, "fill-color", "#0284c7");
              mapInstance.setPaintProperty(layer.id, "fill-opacity", 0.9);
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
            try {
              mapInstance.setPaintProperty(layer.id, "fill-color", "#065f46");
              mapInstance.setPaintProperty(layer.id, "fill-opacity", 0.85);
            } catch {}
          } else if (
            id.includes("landuse") ||
            id.includes("landcover") ||
            id.includes("residential") ||
            id.includes("commercial") ||
            id.includes("industrial")
          ) {
            try {
              mapInstance.setPaintProperty(layer.id, "fill-color", "#0f172a");
              mapInstance.setPaintProperty(layer.id, "fill-opacity", 0.75);
            } catch {}
          } else if (id.includes("building")) {
            const isTopLayer = id.includes("top");
            const buildingColorExpr = [
              "match",
              ["%", ["to-number", ["coalesce", ["id"], ["get", "id"], 1]], 6],
              0, isTopLayer ? "#341c54" : "#1a0f2b",
              1, isTopLayer ? "#113e47" : "#0a2228",
              2, isTopLayer ? "#1a2e56" : "#0d182e",
              3, isTopLayer ? "#442a19" : "#24160c",
              4, isTopLayer ? "#3e162e" : "#220b19",
              5, isTopLayer ? "#212b3d" : "#101620",
              "#1e293b",
            ];

            const buildingOutlineExpr = [
              "match",
              ["%", ["to-number", ["coalesce", ["id"], ["get", "id"], 1]], 6],
              0, "#7c3aed",
              1, "#06b6d4",
              2, "#3b82f6",
              3, "#f59e0b",
              4, "#ec4899",
              5, "#64748b",
              "#334155",
            ];

            try {
              mapInstance.setPaintProperty(layer.id, "fill-color", buildingColorExpr as any);
              mapInstance.setPaintProperty(
                layer.id,
                "fill-outline-color",
                buildingOutlineExpr as any
              );
              mapInstance.setPaintProperty(layer.id, "fill-opacity", 0.95);
            } catch {}
          }
        }

        if (layer.type === "line") {
          if (id.includes("water")) {
            try {
              mapInstance.setPaintProperty(layer.id, "line-color", "#38bdf8");
              mapInstance.setPaintProperty(layer.id, "line-width", 2);
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
            const isPrimary = id.includes("primary") || id.includes("_pri_");
            const isSecondary = id.includes("secondary") || id.includes("_sec_");
            const isCasing = id.includes("case") || id.includes("casing");

            const streetColor = isHighSpeed
              ? "#f59e0b"
              : isPrimary
              ? "#fbbf24"
              : isSecondary
              ? "#fb923c"
              : "#38bdf8";

            try {
              mapInstance.setPaintProperty(
                layer.id,
                "line-color",
                isCasing ? "#020617" : streetColor
              );
              mapInstance.setPaintProperty(
                layer.id,
                "line-opacity",
                isCasing ? 0.95 : isHighSpeed || isPrimary ? 1.0 : 0.82
              );
            } catch {}
          } else if (id.includes("boundary")) {
            try {
              mapInstance.setPaintProperty(layer.id, "line-color", "#f43f5e");
            } catch {}
          }
        }

        if (layer.type === "symbol") {
          try {
            mapInstance.setPaintProperty(layer.id, "text-color", "#ffffff");
            mapInstance.setPaintProperty(layer.id, "text-halo-color", "#020617");
            mapInstance.setPaintProperty(layer.id, "text-halo-width", 2.2);
          } catch {}
        }
      }
    };

    const applyRpg16BitTheme = (mapInstance: MapLibreMap) => {
      // 1. Register 16-bit textures in the sprite catalog
      registerAllRpgTextures(mapInstance);

      const style = mapInstance.getStyle();
      if (!style || !style.layers) return;

      for (const layer of style.layers) {
        const id = layer.id.toLowerCase();

        // Hide POIs and boundary lines (clean up messy orange dashed lines in intersections)
        if (
          id.includes("poi") ||
          id.includes("aeroway") ||
          id.includes("housenumber") ||
          id.includes("boundary")
        ) {
          try {
            mapInstance.setLayoutProperty(layer.id, "visibility", "none");
          } catch {}
          continue;
        }

        // 2. Background: 16-Bit Seamless Grass Pattern
        if (layer.type === "background") {
          try {
            mapInstance.setPaintProperty(
              layer.id,
              "background-pattern",
              "rpg-grass-pattern"
            );
          } catch {}
        }

        if (layer.type === "fill") {
          if (id.includes("water")) {
            // Pixelated water ripples
            try {
              mapInstance.setPaintProperty(
                layer.id,
                "fill-pattern",
                "rpg-water-pattern"
              );
              mapInstance.setPaintProperty(layer.id, "fill-opacity", 1.0);
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
            // Dense forest texture
            try {
              mapInstance.setPaintProperty(
                layer.id,
                "fill-pattern",
                "rpg-park-forest-pattern"
              );
              mapInstance.setPaintProperty(layer.id, "fill-opacity", 1.0);
            } catch {}
          } else if (
            id.includes("landuse") ||
            id.includes("landcover") ||
            id.includes("residential") ||
            id.includes("commercial") ||
            id.includes("industrial")
          ) {
            // Urban blocks: seamless 16-bit grass
            try {
              mapInstance.setPaintProperty(
                layer.id,
                "fill-pattern",
                "rpg-grass-pattern"
              );
              mapInstance.setPaintProperty(layer.id, "fill-opacity", 1.0);
            } catch {}
          } else if (id.includes("building")) {
            // Modern 16-bit Buildings
            const isTopLayer = id.includes("top");

            const modernRoofPatterns = [
              "match",
              ["%", ["to-number", ["coalesce", ["id"], ["get", "id"], 1]], 6],
              0, "rpg-roof-white-modern",
              1, "rpg-roof-slate-modern",
              2, "rpg-roof-deck-modern",
              3, "rpg-roof-solar-modern",
              4, "rpg-roof-green-modern",
              5, "rpg-roof-sand-modern",
              "rpg-roof-white-modern",
            ];

            const modernWallColors = [
              "match",
              ["%", ["to-number", ["coalesce", ["id"], ["get", "id"], 1]], 6],
              0, "#475569", // Pared cemento visto
              1, "#1e293b", // Pared grafito oscuro
              2, "#5c3d22", // Pared madera oscura
              3, "#17334d", // Pared azul noche
              4, "#27420f", // Pared piedra ecológica
              5, "#6b5945", // Pared piedra caliza
              "#334155",
            ];

            const modernOutlineColors = [
              "match",
              ["%", ["to-number", ["coalesce", ["id"], ["get", "id"], 1]], 6],
              0, "#334155",
              1, "#0f172a",
              2, "#3b2513",
              3, "#0c1d2e",
              4, "#142406",
              5, "#3b3024",
              "#1e293b",
            ];

            try {
              if (isTopLayer) {
                // Apply textured modern roof
                mapInstance.setPaintProperty(
                  layer.id,
                  "fill-pattern",
                  modernRoofPatterns as any
                );
                mapInstance.setPaintProperty(
                  layer.id,
                  "fill-outline-color",
                  modernOutlineColors as any
                );
                mapInstance.setPaintProperty(layer.id, "fill-translate", [-2.5, -2.5]);
                mapInstance.setPaintProperty(layer.id, "fill-opacity", 1.0);
              } else {
                // Base wall underneath
                mapInstance.setPaintProperty(
                  layer.id,
                  "fill-color",
                  modernWallColors as any
                );
                mapInstance.setPaintProperty(layer.id, "fill-opacity", 0.98);
              }
            } catch {}
          }
        }

        // 4. Lines (Roads)
        if (layer.type === "line") {
          if (id.includes("water")) {
            try {
              mapInstance.setPaintProperty(layer.id, "line-color", "#2582bf");
              mapInstance.setPaintProperty(layer.id, "line-width", 2.2);
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
            const isPrimary = id.includes("primary") || id.includes("_pri_");
            const isSecondary = id.includes("secondary") || id.includes("_sec_");
            const isPath =
              id.includes("path") ||
              id.includes("pedestrian") ||
              id.includes("footway");
            const isCasing = id.includes("case") || id.includes("casing");

            const streetColor = isPath
              ? "#c49c66"
              : isHighSpeed
              ? "#2b323c"
              : isPrimary
              ? "#434c58"
              : isSecondary
              ? "#56606f"
              : "#8c96a3";

            const casingColor = isPath
              ? "#5c3d22"
              : isHighSpeed
              ? "#1e293b"
              : isPrimary
              ? "#334155"
              : "#4a5563";

            try {
              mapInstance.setPaintProperty(
                layer.id,
                "line-color",
                isCasing ? casingColor : streetColor
              );
              mapInstance.setPaintProperty(
                layer.id,
                "line-opacity",
                isCasing ? 0.95 : 1.0
              );
            } catch {}
          }
        }

        // 5. Symbols (Labels)
        if (layer.type === "symbol") {
          try {
            mapInstance.setPaintProperty(layer.id, "text-color", "#ffffff");
            mapInstance.setPaintProperty(layer.id, "text-halo-color", "#0f172a");
            mapInstance.setPaintProperty(layer.id, "text-halo-width", 2.6);
          } catch {}
        }
      }
    };

    const applyThemeToMap = (targetTheme: ArcadeMapTheme) => {
      if (!map.isStyleLoaded()) return;
      if (targetTheme === "rpg-16bit") {
        applyRpg16BitTheme(map);
        try {
          setRpgTreesVisibility(map, true);
          syncRpgTreesOnMap(map);
        } catch {}
      } else {
        try {
          setRpgTreesVisibility(map, false);
        } catch {}
        applyCyberpunkDarkTheme(map);
      }
    };

    applyThemeFnRef.current = applyThemeToMap;

    const applyArcade16BitPalette = () => {
      applyThemeToMap(activeThemeRef.current);

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

    const syncTreesIfRpg = () => {
      if (activeThemeRef.current === "rpg-16bit") {
        try {
          syncRpgTreesOnMap(map);
        } catch {}
      }
    };

    map.on("moveend", syncTreesIfRpg);
    map.on("zoomend", syncTreesIfRpg);
    map.on("idle", () => {
      if (
        activeThemeRef.current === "rpg-16bit" &&
        !map.getLayer("rpg-trees-layer")
      ) {
        syncTreesIfRpg();
      }
    });

    if (mode === "player") {
      map.on("dragstart", (ev) => {
        if (ev.originalEvent && !isUserPannedRef.current) {
          isUserPannedRef.current = true;
          setIsUserPanned(true);
        }
      });
    }

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
      beaconMarkersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
      applyThemeFnRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive Map Theme Switch (rpg-16bit <-> cyberpunk-dark)
  useEffect(() => {
    if (applyThemeFnRef.current) {
      applyThemeFnRef.current(activeTheme);
    }
  }, [activeTheme]);

  // Reactive Compass / DeviceOrientation Bearing Control (player mode)
  useEffect(() => {
    if (!compassEnabled || mode !== "player") return;
    let active = true;

    const handleOrientation = (ev: DeviceOrientationEvent) => {
      if (!active || !mapRef.current) return;
      const extEv = ev as DeviceOrientationEvent & {
        webkitCompassHeading?: number;
      };
      let heading: number | null = null;
      if (typeof extEv.webkitCompassHeading === "number") {
        heading = extEv.webkitCompassHeading;
      } else if (typeof ev.alpha === "number") {
        heading = (360 - ev.alpha) % 360;
      }
      if (heading !== null && Number.isFinite(heading)) {
        try {
          mapRef.current.setBearing(heading);
        } catch {}
      }
    };

    window.addEventListener("deviceorientationabsolute", handleOrientation as EventListener);
    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      active = false;
      window.removeEventListener(
        "deviceorientationabsolute",
        handleOrientation as EventListener
      );
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [compassEnabled, mode]);

  // Reactive Heatmap Layer Sync
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      syncHeatmapOnMap(map, heatmapPoints, showHeatmap);
    } catch {}
  }, [heatmapPoints, showHeatmap]);

  // Smooth pan when centerLat / centerLng updates (paused while player manually explores map)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || isUserPannedRef.current) return;
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

  const handleRecenterPlayer = useCallback(() => {
    isUserPannedRef.current = false;
    setIsUserPanned(false);
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      center: [latestCoordsRef.current.lng, latestCoordsRef.current.lat],
      zoom: Math.max(map.getZoom(), 16.2),
      duration: 500,
    });
  }, []);

  const handleToggleCompass = useCallback(async () => {
    if (compassEnabled) {
      setCompassEnabled(false);
      mapRef.current?.easeTo({ bearing: 0, duration: 350 });
      return;
    }

    try {
      const DeviceOrient = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (DeviceOrient && typeof DeviceOrient.requestPermission === "function") {
        const res = await DeviceOrient.requestPermission();
        if (res !== "granted") return;
      }
    } catch {
      // Non-iOS or permission API absent
    }
    setCompassEnabled(true);
  }, [compassEnabled]);

  const handleSwitchTheme = useCallback(() => {
    const next: ArcadeMapTheme =
      activeTheme === "rpg-16bit" ? "cyberpunk-dark" : "rpg-16bit";
    if (onThemeChange) {
      onThemeChange(next);
    } else {
      setInternalTheme(next);
    }
  }, [activeTheme, onThemeChange]);

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

  // Public-Zone Route Bonus Beacons rendered with 16-bit PixelLab Repeater Tower sprite (player mode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "player") return;

    beaconMarkersRef.current.forEach((m) => m.remove());
    beaconMarkersRef.current = [];

    for (const beacon of bonusBeacons) {
      const el = document.createElement("div");
      const accent = beacon.collected ? "#22c55e" : "#00f0ff";
      const bg = beacon.collected ? "#052e16" : "#082f49";
      const towerFilter = beacon.collected
        ? "hue-rotate(-45deg) saturate(1.15) drop-shadow(0 0 6px #22c55e)"
        : "drop-shadow(0 0 7px #00f0ff)";
      el.className = "pointer-events-none select-none";
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;position:relative;">
          <span style="background:${bg};border:1.5px solid ${accent};color:${accent};font-size:8.5px;font-weight:900;letter-spacing:0.04em;padding:1px 5px;border-radius:3px;white-space:nowrap;box-shadow:0 0 8px ${accent}55;display:inline-flex;align-items:center;gap:3px;margin-bottom:2px;">
            ${beacon.collected ? BEACON_DONE_SVG_HTML : ""}
            <span>${beacon.collected ? "ACTIVADA" : beacon.label}</span>
          </span>
          <img src="/sprites/beacon_tower.png" alt="${beacon.label}" width="40" height="40" style="width:40px;height:40px;object-fit:contain;image-rendering:pixelated;filter:${towerFilter};position:relative;z-index:2;" />
          <span class="${beacon.collected ? "" : "rf-beacon-ring"}" style="width:18px;height:8px;border-radius:9999px;border:2px solid ${accent};background:${accent}33;margin-top:-5px;z-index:1;"></span>
        </div>
      `;
      const m = new Marker({ element: el, anchor: "bottom" })
        .setLngLat([beacon.lng, beacon.lat])
        .addTo(map);
      beaconMarkersRef.current.push(m);
    }
  }, [bonusBeacons, mode]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#080d1a]">
      <div
        ref={containerRef}
        className="arcade-map-wrapper w-full h-full relative"
      />

      {mode === "player" && interactive && (
        <div className="absolute right-2.5 bottom-[222px] z-20 flex flex-col gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={handleRecenterPlayer}
            title="Re-centrar cámara en mi ubicación"
            aria-label="Re-centrar en mí"
            className={`px-2 py-1.5 rf-btn-steel flex items-center gap-1 text-[10px] font-bold shadow-lg ${
              isUserPanned
                ? "border-cyan-300 text-cyan-200 animate-pulse"
                : "text-slate-200 opacity-85"
            }`}
          >
            <LocateFixed className="w-3.5 h-3.5 text-cyan-300" />
            {isUserPanned && <span>CENTRAR</span>}
          </button>

          <button
            type="button"
            onClick={handleToggleCompass}
            title="Rotar mapa con brújula del dispositivo"
            aria-label="Activar brújula del mapa"
            className={`p-2 rf-btn-steel flex items-center justify-center shadow-lg ${
              compassEnabled
                ? "border-amber-400 text-amber-300"
                : "text-slate-300 opacity-85"
            }`}
          >
            <Compass
              className={`w-3.5 h-3.5 ${compassEnabled ? "animate-spin" : ""}`}
              style={compassEnabled ? { animationDuration: "6s" } : undefined}
            />
          </button>

          <button
            type="button"
            onClick={handleSwitchTheme}
            title={
              activeTheme === "rpg-16bit"
                ? "Cambiar a Modo Nocturno"
                : "Cambiar a Modo Día RPG 16-Bit"
            }
            aria-label="Cambiar tema visual del mapa"
            className="p-2 rf-btn-steel text-amber-200 flex items-center justify-center shadow-lg opacity-90"
          >
            {activeTheme === "rpg-16bit" ? (
              <Moon className="w-3.5 h-3.5 text-indigo-300" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-300" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
