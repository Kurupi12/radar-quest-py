// ============================================================================
// RADAR QUEST - 16-Bit RPG Texture & Tree Generator for MapLibre Vector Layers
// Generates authentic pixel-art pattern tiles (Grass, Water, Cobblestone, Roofs)
// and procedural 16-bit RPG trees (Round dark, Round light, Pine, Shrub)
// ============================================================================

import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";

function parseHex(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

class PixelBitmapBuilder {
  width: number;
  height: number;
  data: Uint8ClampedArray;

  constructor(width: number, height: number, defaultHex?: string) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    if (defaultHex) {
      const [r, g, b] = parseHex(defaultHex);
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        this.data[idx] = r;
        this.data[idx + 1] = g;
        this.data[idx + 2] = b;
        this.data[idx + 3] = 255;
      }
    }
  }

  setPixel(x: number, y: number, hex: string, alpha = 255) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    const [r, g, b] = parseHex(hex);
    this.data[idx] = r;
    this.data[idx + 1] = g;
    this.data[idx + 2] = b;
    this.data[idx + 3] = alpha;
  }

  fillRect(x: number, y: number, w: number, h: number, hex: string, alpha = 255) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.setPixel(x + dx, y + dy, hex, alpha);
      }
    }
  }

  fillCircle(cx: number, cy: number, r: number, hex: string) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (d <= r) this.setPixel(x, y, hex);
      }
    }
  }

  strokeCircle(cx: number, cy: number, r: number, hex: string) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (d >= r - 0.75 && d <= r + 0.75) this.setPixel(x, y, hex);
      }
    }
  }

  toImageData(): { width: number; height: number; data: Uint8ClampedArray } {
    return {
      width: this.width,
      height: this.height,
      data: this.data,
    };
  }
}

/**
 * 1. 16-Bit RPG Grass Texture (32x32)
 */
export function buildRpgGrassTexture(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(32, 32, "#5cb236");

  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if ((x + y) % 4 === 0) {
        b.setPixel(x, y, "#52a62e");
      } else if ((x * 3 + y * 7) % 11 === 0) {
        b.setPixel(x, y, "#66be40");
      }
    }
  }

  const drawTuft = (tx: number, ty: number) => {
    b.setPixel(tx, ty + 2, "#347a19");
    b.setPixel(tx + 1, ty + 2, "#347a19");
    b.setPixel(tx + 2, ty + 2, "#347a19");
    b.setPixel(tx, ty + 1, "#429622");
    b.setPixel(tx + 1, ty + 1, "#429622");
    b.setPixel(tx + 2, ty + 1, "#429622");
    b.setPixel(tx, ty, "#80ea52");
    b.setPixel(tx + 2, ty, "#80ea52");
  };

  drawTuft(5, 7);
  drawTuft(19, 3);
  drawTuft(12, 17);
  drawTuft(27, 13);
  drawTuft(3, 25);
  drawTuft(22, 23);
  drawTuft(15, 29);
  drawTuft(29, 28);

  b.setPixel(9, 21, "#2e6e18");
  b.setPixel(9, 20, "#facc15");
  b.setPixel(8, 20, "#ffffff");
  b.setPixel(10, 20, "#ffffff");
  b.setPixel(9, 19, "#ffffff");

  b.setPixel(24, 9, "#2e6e18");
  b.setPixel(24, 8, "#fef08a");
  b.setPixel(25, 8, "#facc15");

  b.setPixel(4, 14, "#ffffff");
  b.setPixel(5, 14, "#fef08a");

  return b.toImageData();
}

/**
 * 2. 16-Bit Dense Park/Forest Texture (32x32)
 */
export function buildRpgParkForestTexture(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(32, 32, "#388820");

  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if ((x + y * 2) % 3 === 0) {
        b.setPixel(x, y, "#2e7419");
      } else if ((x * 5 + y * 3) % 7 === 0) {
        b.setPixel(x, y, "#469c2b");
      }
    }
  }

  const drawFoliageCluster = (cx: number, cy: number) => {
    b.fillRect(cx, cy, 3, 2, "#20560f");
    b.setPixel(cx + 1, cy - 1, "#4da82f");
    b.setPixel(cx + 2, cy - 1, "#4da82f");
  };

  drawFoliageCluster(6, 6);
  drawFoliageCluster(20, 10);
  drawFoliageCluster(10, 22);
  drawFoliageCluster(24, 24);

  return b.toImageData();
}

/**
 * 3. 16-Bit Crystal Water with Pixel Waves (32x32)
 */
export function buildRpgWaterTexture(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(32, 32, "#44b4f5");

  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (y % 4 === 3) {
        b.setPixel(x, y, "#339edc");
      }
    }
  }

  const drawWave = (wx: number, wy: number, len: number) => {
    for (let i = 0; i < len; i++) {
      b.setPixel(wx + i, wy, "#2586bf");
      b.setPixel(wx + i, wy - 1, i === 1 || i === 2 ? "#ffffff" : "#bce8fd");
    }
  };

  drawWave(3, 6, 5);
  drawWave(18, 4, 4);
  drawWave(10, 14, 6);
  drawWave(25, 16, 5);
  drawWave(5, 22, 4);
  drawWave(20, 26, 5);

  return b.toImageData();
}

/**
 * 4. Modern White Minimalist Concrete Roof (16x16)
 */
export function buildModernWhiteRoofTexture(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(16, 16, "#f1f5f9");

  for (let i = 0; i < 16; i++) {
    b.setPixel(i, 0, "#cbd5e1");
    b.setPixel(i, 8, "#cbd5e1");
    b.setPixel(0, i, "#cbd5e1");
    b.setPixel(8, i, "#cbd5e1");
  }

  b.fillRect(6, 6, 4, 4, "#38bdf8");
  b.fillRect(7, 7, 2, 2, "#e0f2fe");
  b.setPixel(6, 6, "#ffffff");

  return b.toImageData();
}

/**
 * 5. Modern Anthracite Slate Roof with Rooftop HVAC (16x16)
 */
export function buildModernSlateRoofTexture(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(16, 16, "#334155");

  for (let i = 0; i < 16; i++) {
    b.setPixel(i, 0, "#1e293b");
    b.setPixel(i, 8, "#1e293b");
    b.setPixel(0, i, "#1e293b");
    b.setPixel(8, i, "#1e293b");
  }

  b.fillRect(6, 6, 4, 3, "#94a3b8");
  b.fillRect(7, 7, 2, 1, "#475569");
  b.setPixel(6, 6, "#cbd5e1");

  return b.toImageData();
}

/**
 * 6. Modern Teak Wood Deck Terrace Roof (16x16)
 */
export function buildModernDeckRoofTexture(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(16, 16, "#bf8a58");

  for (let y = 0; y < 16; y++) {
    if (y % 4 === 3) {
      for (let x = 0; x < 16; x++) {
        b.setPixel(x, y, "#5c3a1e");
      }
    } else if (y % 4 === 0) {
      for (let x = 0; x < 16; x++) {
        b.setPixel(x, y, "#d49b65");
      }
    }
  }

  b.fillRect(10, 10, 4, 3, "#f8fafc");
  b.setPixel(10, 10, "#e2e8f0");

  return b.toImageData();
}

/**
 * 7. Modern Solar Panels Roof (16x16)
 */
export function buildModernSolarRoofTexture(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(16, 16, "#1e293b");

  const drawPanel = (px: number, py: number) => {
    b.fillRect(px, py, 6, 6, "#1d4ed8");
    b.fillRect(px + 1, py + 1, 4, 4, "#2563eb");
    b.setPixel(px + 2, py + 1, "#93c5fd");
    b.setPixel(px + 2, py + 2, "#93c5fd");
    b.setPixel(px + 2, py + 3, "#93c5fd");
    b.setPixel(px + 2, py + 4, "#93c5fd");
    b.setPixel(px + 1, py + 1, "#ffffff");
  };

  drawPanel(1, 1);
  drawPanel(9, 1);
  drawPanel(1, 9);
  drawPanel(9, 9);

  return b.toImageData();
}

/**
 * 8. Modern Sustainable Rooftop Garden (16x16)
 */
export function buildModernGreenRoofTexture(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(16, 16, "#4d8224");

  for (let i = 0; i < 16; i++) {
    b.setPixel(i, 0, "#78716c");
    b.setPixel(i, 15, "#78716c");
    b.setPixel(0, i, "#78716c");
    b.setPixel(15, i, "#78716c");
  }

  for (let y = 1; y < 15; y++) {
    for (let x = 1; x < 15; x++) {
      if ((x + y) % 3 === 0) b.setPixel(x, y, "#3f6e1b");
      if ((x * 3 + y) % 5 === 0) b.setPixel(x, y, "#5fa02d");
    }
  }

  b.setPixel(5, 5, "#fef08a");
  b.setPixel(11, 10, "#ffffff");

  return b.toImageData();
}

/**
 * 9. Modern Limestone Pavers Roof (16x16)
 */
export function buildModernSandRoofTexture(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(16, 16, "#d8c8b2");

  for (let i = 0; i < 16; i++) {
    b.setPixel(i, 0, "#b39e84");
    b.setPixel(i, 8, "#b39e84");
    b.setPixel(0, i, "#b39e84");
    b.setPixel(8, i, "#b39e84");
  }

  b.fillRect(5, 5, 6, 6, "#786550");
  for (let y = 5; y <= 10; y += 2) {
    for (let x = 5; x <= 10; x++) {
      b.setPixel(x, y, "#4a3c2e");
    }
  }

  return b.toImageData();
}

// ============================================================================
// 16-BIT PROCEDURAL RPG TREE SPRITES (Transparent 2.5D Overworld Trees)
// ============================================================================

/**
 * 10. Round Dark Deciduous Tree (24x28 px)
 */
export function buildRpgTreeRoundDark(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(24, 28); // Transparent

  // Trunk
  b.fillRect(10, 19, 4, 7, "#4a2e12");
  b.setPixel(9, 25, "#331a0a");
  b.setPixel(9, 26, "#331a0a");
  b.setPixel(14, 25, "#331a0a");
  b.setPixel(14, 26, "#331a0a");
  b.fillRect(11, 20, 1, 5, "#6e441c"); // Bark highlight

  // Ground shadow at roots
  b.fillRect(8, 26, 8, 2, "#13380d", 140);

  // Rounded canopy lobes
  b.fillCircle(12, 11, 8.5, "#1b5413");
  b.fillCircle(12, 8, 6.5, "#2d801e");
  b.fillCircle(7, 12, 5, "#225c14");
  b.fillCircle(17, 12, 5, "#1b5413");

  // Foliage sun highlights
  b.fillCircle(10, 7, 4, "#59b83a");
  b.fillCircle(9, 6, 2.5, "#7ce84e");
  b.setPixel(8, 5, "#bcf76a");

  // Crisp 16-bit dark outline
  b.strokeCircle(12, 11, 8.5, "#0e2908");
  b.strokeCircle(12, 8, 6.5, "#0e2908");
  b.strokeCircle(7, 12, 5, "#0e2908");
  b.strokeCircle(17, 12, 5, "#0e2908");

  return b.toImageData();
}

/**
 * 11. Round Light / Apple Green Tree (24x28 px)
 */
export function buildRpgTreeRoundLight(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(24, 28);

  // Trunk
  b.fillRect(10, 19, 4, 7, "#543314");
  b.setPixel(9, 25, "#3b220b");
  b.setPixel(9, 26, "#3b220b");
  b.setPixel(14, 25, "#3b220b");
  b.setPixel(14, 26, "#3b220b");
  b.fillRect(11, 20, 1, 5, "#7d4d1f");

  b.fillRect(8, 26, 8, 2, "#1a4210", 140);

  // Lime green canopy lobes
  b.fillCircle(12, 11, 8.5, "#2c6e14");
  b.fillCircle(12, 8, 6.5, "#4ba824");
  b.fillCircle(7, 12, 5, "#377d19");
  b.fillCircle(17, 12, 5, "#2c6e14");

  // Bright highlights
  b.fillCircle(10, 7, 4, "#82db37");
  b.fillCircle(9, 6, 2.5, "#bcf76a");
  b.setPixel(8, 5, "#efffc2");

  // Crisp outline
  b.strokeCircle(12, 11, 8.5, "#143309");
  b.strokeCircle(12, 8, 6.5, "#143309");
  b.strokeCircle(7, 12, 5, "#143309");
  b.strokeCircle(17, 12, 5, "#143309");

  return b.toImageData();
}

/**
 * 12. Conifer / Pine Tree (20x28 px)
 */
export function buildRpgTreePine(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(20, 28);

  // Trunk
  b.fillRect(9, 21, 3, 6, "#3e220f");
  b.fillRect(7, 26, 7, 2, "#0a2618", 140);

  // 3-tiered pine cone shapes
  // Tier 1 (bottom)
  for (let y = 17; y <= 22; y++) {
    const halfW = Math.round((y - 17) * 1.3) + 2;
    for (let x = 10 - halfW; x <= 10 + halfW; x++) {
      b.setPixel(x, y, x < 10 ? "#1f6e46" : "#13472d");
    }
    b.setPixel(10 - halfW, y, "#0a2618");
    b.setPixel(10 + halfW, y, "#0a2618");
  }

  // Tier 2 (middle)
  for (let y = 10; y <= 17; y++) {
    const halfW = Math.round((y - 10) * 0.95) + 2;
    for (let x = 10 - halfW; x <= 10 + halfW; x++) {
      b.setPixel(x, y, x < 10 ? "#288756" : "#195c3b");
    }
    b.setPixel(10 - halfW, y, "#0a2618");
    b.setPixel(10 + halfW, y, "#0a2618");
  }

  // Tier 3 (top peak)
  for (let y = 3; y <= 11; y++) {
    const halfW = Math.round((y - 3) * 0.7) + 1;
    for (let x = 10 - halfW; x <= 10 + halfW; x++) {
      b.setPixel(x, y, x < 10 ? "#3bb878" : "#237a4e");
    }
    b.setPixel(10 - halfW, y, "#0a2618");
    b.setPixel(10 + halfW, y, "#0a2618");
  }

  b.setPixel(10, 2, "#3bb878");
  b.setPixel(10, 1, "#0a2618");

  return b.toImageData();
}

/**
 * 13. Small Garden Bush / Shrub (16x14 px)
 */
export function buildRpgShrub(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(16, 14);

  b.fillRect(4, 12, 8, 2, "#13380d", 140);

  b.fillCircle(8, 8, 5.5, "#256916");
  b.fillCircle(6, 6, 3.5, "#4ca82b");
  b.fillCircle(5, 5, 2, "#7ce84e");

  b.strokeCircle(8, 8, 5.5, "#13380d");

  return b.toImageData();
}

// ============================================================================
// PROCEDURAL DETERMINISTIC GEOJSON TREE GENERATOR
// ============================================================================

function cellHash(gx: number, gy: number): number {
  let h = (gx * 374761393 + gy * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
}

export interface TreeBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface TreeFeature {
  type: "Feature";
  properties: { treeType: string };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

export interface TreeFeatureCollection {
  type: "FeatureCollection";
  features: TreeFeature[];
}

/**
 * Generates deterministic GeoJSON tree features across a bounding box
 */
export function generateRpgTreesGeoJson(bounds: TreeBounds): TreeFeatureCollection {
  const baseStep = 0.00035; // ~38 meters per cell
  const lngSpan = Math.max(0.0001, bounds.east - bounds.west);
  const latSpan = Math.max(0.0001, bounds.north - bounds.south);
  const estCells = (lngSpan / baseStep) * (latSpan / baseStep);
  // Discrete deterministic grid LOD tiers keep tree positions locked when panning while staying 60fps zoomed out
  const step =
    estCells > 14_000
      ? baseStep * 4
      : estCells > 3_600
      ? baseStep * 2
      : baseStep;
  const features: TreeFeature[] = [];

  const startX = Math.floor(bounds.west / step);
  const endX = Math.floor(bounds.east / step);
  const startY = Math.floor(bounds.south / step);
  const endY = Math.floor(bounds.north / step);

  const treeTypes = [
    "rpg-tree-round-dark",
    "rpg-tree-round-light",
    "rpg-tree-pine",
    "rpg-shrub",
  ];

  for (let gy = startY; gy <= endY; gy++) {
    for (let gx = startX; gx <= endX; gx++) {
      const h = cellHash(gx, gy);
      const r = h % 100;

      // 32% probability of no tree (keeps streets and house footprints breathable)
      if (r < 32) continue;

      const typeIdx = (h >> 4) % treeTypes.length;
      const offX = ((h >> 8) % 70) / 100 + 0.15;
      const offY = ((h >> 14) % 70) / 100 + 0.15;
      const lng = (gx + offX) * step;
      const lat = (gy + offY) * step;

      features.push({
        type: "Feature",
        properties: { treeType: treeTypes[typeIdx] },
        geometry: { type: "Point", coordinates: [lng, lat] },
      });

      // 22% chance of a secondary tree forming a grove / park cluster
      if (r > 78) {
        const offX2 = ((h >> 18) % 60) / 100 + 0.2;
        const offY2 = ((h >> 22) % 60) / 100 + 0.2;
        features.push({
          type: "Feature",
          properties: {
            treeType: treeTypes[(typeIdx + 1) % treeTypes.length],
          },
          geometry: {
            type: "Point",
            coordinates: [(gx + offX2) * step, (gy + offY2) * step],
          },
        });
      }
    }
  }

  return { type: "FeatureCollection", features };
}

export const RPG_TREES_SOURCE_ID = "rpg-trees-source";
export const RPG_TREES_LAYER_ID = "rpg-trees-layer";

/**
 * Registers all 16-bit textures and tree sprites into MapLibre
 */
export function registerAllRpgTextures(map: MapLibreMap): void {
  const textures: [string, () => { width: number; height: number; data: Uint8ClampedArray }][] = [
    ["rpg-grass-pattern", buildRpgGrassTexture],
    ["rpg-park-forest-pattern", buildRpgParkForestTexture],
    ["rpg-water-pattern", buildRpgWaterTexture],
    ["rpg-roof-white-modern", buildModernWhiteRoofTexture],
    ["rpg-roof-slate-modern", buildModernSlateRoofTexture],
    ["rpg-roof-deck-modern", buildModernDeckRoofTexture],
    ["rpg-roof-solar-modern", buildModernSolarRoofTexture],
    ["rpg-roof-green-modern", buildModernGreenRoofTexture],
    ["rpg-roof-sand-modern", buildModernSandRoofTexture],
    // 16-Bit Tree Sprites
    ["rpg-tree-round-dark", buildRpgTreeRoundDark],
    ["rpg-tree-round-light", buildRpgTreeRoundLight],
    ["rpg-tree-pine", buildRpgTreePine],
    ["rpg-shrub", buildRpgShrub],
  ];

  for (const [id, builder] of textures) {
    if (!map.hasImage(id)) {
      try {
        const imgData = builder();
        map.addImage(id, imgData, { pixelRatio: 1 });
      } catch (err) {
        console.warn(`[ArcadeMap] Error registering texture ${id}:`, err);
      }
    }
  }
}

export function setRpgTreesVisibility(
  map: MapLibreMap,
  visible: boolean
): void {
  if (!map.getStyle()) return;
  try {
    if (map.getLayer(RPG_TREES_LAYER_ID)) {
      map.setLayoutProperty(
        RPG_TREES_LAYER_ID,
        "visibility",
        visible ? "visible" : "none"
      );
    }
  } catch {
    // Ignore if layer does not exist yet
  }
}

/**
 * Syncs the procedural RPG tree layer based on current map viewport bounds
 */
export function syncRpgTreesOnMap(map: MapLibreMap): void {
  if (!map.getStyle()) return;
  registerAllRpgTextures(map);

  const bounds = map.getBounds();
  const lngSpan = bounds.getEast() - bounds.getWest();
  const latSpan = bounds.getNorth() - bounds.getSouth();

  const paddedBounds: TreeBounds = {
    west: bounds.getWest() - lngSpan * 0.35,
    east: bounds.getEast() + lngSpan * 0.35,
    south: bounds.getSouth() - latSpan * 0.35,
    north: bounds.getNorth() + latSpan * 0.35,
  };

  const geojson = generateRpgTreesGeoJson(paddedBounds);
  const existingSource = map.getSource(RPG_TREES_SOURCE_ID) as GeoJSONSource | undefined;

  if (existingSource) {
    existingSource.setData(geojson);
  } else {
    map.addSource(RPG_TREES_SOURCE_ID, {
      type: "geojson",
      data: geojson,
    });

    // Find the first symbol layer (labels) to insert trees beneath text labels
    const style = map.getStyle();
    let beforeLayerId: string | undefined = undefined;
    if (style && style.layers) {
      for (const l of style.layers) {
        if (l.type === "symbol" && l.id.toLowerCase().includes("roadname")) {
          beforeLayerId = l.id;
          break;
        }
      }
    }

    map.addLayer(
      {
        id: RPG_TREES_LAYER_ID,
        type: "symbol",
        source: RPG_TREES_SOURCE_ID,
        minzoom: 12,
        layout: {
          "icon-image": ["get", "treeType"],
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            0.38,
            14,
            0.58,
            16,
            0.85,
            18,
            1.1,
          ],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-anchor": "bottom",
        },
      },
      beforeLayerId
    );
  }
}
