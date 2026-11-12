// ============================================================================
// RADAR QUEST - 16-Bit RPG Texture Generator for MapLibre Vector Layers
// Generates authentic pixel-art pattern tiles (Grass, Water, Cobblestone, Roofs)
// ============================================================================

import type { Map as MapLibreMap } from "maplibre-gl";

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

  constructor(width: number, height: number, defaultHex: string) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    const [r, g, b] = parseHex(defaultHex);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      this.data[idx] = r;
      this.data[idx + 1] = g;
      this.data[idx + 2] = b;
      this.data[idx + 3] = 255;
    }
  }

  setPixel(x: number, y: number, hex: string, alpha = 255) {
    const wrappedX = ((x % this.width) + this.width) % this.width;
    const wrappedY = ((y % this.height) + this.height) % this.height;
    const idx = (wrappedY * this.width + wrappedX) * 4;
    const [r, g, b] = parseHex(hex);
    this.data[idx] = r;
    this.data[idx + 1] = g;
    this.data[idx + 2] = b;
    this.data[idx + 3] = alpha;
  }

  fillRect(x: number, y: number, w: number, h: number, hex: string) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.setPixel(x + dx, y + dy, hex);
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
 * Rich Zelda/Pokemon vibrant green with organic pixel dithering, grass tufts & wild micro-flowers
 */
export function buildRpgGrassTexture(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(32, 32, "#5cb236");

  // Subtle organic pixel dither (alternating checkerboard variation)
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if ((x + y) % 4 === 0) {
        b.setPixel(x, y, "#52a62e");
      } else if ((x * 3 + y * 7) % 11 === 0) {
        b.setPixel(x, y, "#66be40");
      }
    }
  }

  // Helper for 16-bit grass tuft (3px wide x 3px high)
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

  // Place tufts across the 32x32 seamless tile
  drawTuft(5, 7);
  drawTuft(19, 3);
  drawTuft(12, 17);
  drawTuft(27, 13);
  drawTuft(3, 25);
  drawTuft(22, 23);
  drawTuft(15, 29);
  drawTuft(29, 28);

  // Micro-Flower 1: Yellow Wild Daisy
  b.setPixel(9, 21, "#2e6e18");
  b.setPixel(9, 20, "#facc15");
  b.setPixel(8, 20, "#ffffff");
  b.setPixel(10, 20, "#ffffff");
  b.setPixel(9, 19, "#ffffff");

  // Micro-Flower 2: Golden Dandelion
  b.setPixel(24, 9, "#2e6e18");
  b.setPixel(24, 8, "#fef08a");
  b.setPixel(25, 8, "#facc15");

  // Micro-Flower 3: White Clover
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

  // Dense foliage shadows
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

  // Water depth dither
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (y % 4 === 3) {
        b.setPixel(x, y, "#339edc");
      }
    }
  }

  // Horizontal wave crests
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
 * White concrete pavers with architectural sky-view skylight window
 */
export function buildModernWhiteRoofTexture(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const b = new PixelBitmapBuilder(16, 16, "#f1f5f9");

  // Grid seams (8x8 slabs)
  for (let i = 0; i < 16; i++) {
    b.setPixel(i, 0, "#cbd5e1");
    b.setPixel(i, 8, "#cbd5e1");
    b.setPixel(0, i, "#cbd5e1");
    b.setPixel(8, i, "#cbd5e1");
  }

  // Modern blue glass skylight in center (4x4)
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

  // Grid seams
  for (let i = 0; i < 16; i++) {
    b.setPixel(i, 0, "#1e293b");
    b.setPixel(i, 8, "#1e293b");
    b.setPixel(0, i, "#1e293b");
    b.setPixel(8, i, "#1e293b");
  }

  // Rooftop modern HVAC / AC unit (4x3 px)
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

  // Horizontal wood deck planks (every 4px)
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

  // Modern terrace lounge cushion in corner
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

  // 4 Photovoltaic Solar Modules (6x6 each)
  const drawPanel = (px: number, py: number) => {
    b.fillRect(px, py, 6, 6, "#1d4ed8");
    b.fillRect(px + 1, py + 1, 4, 4, "#2563eb");
    // Busbar silver grid lines
    b.setPixel(px + 2, py + 1, "#93c5fd");
    b.setPixel(px + 2, py + 2, "#93c5fd");
    b.setPixel(px + 2, py + 3, "#93c5fd");
    b.setPixel(px + 2, py + 4, "#93c5fd");
    b.setPixel(px + 1, py + 1, "#ffffff"); // Sun glint
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

  // Stone gravel border around rooftop garden
  for (let i = 0; i < 16; i++) {
    b.setPixel(i, 0, "#78716c");
    b.setPixel(i, 15, "#78716c");
    b.setPixel(0, i, "#78716c");
    b.setPixel(15, i, "#78716c");
  }

  // Lawn dithering
  for (let y = 1; y < 15; y++) {
    for (let x = 1; x < 15; x++) {
      if ((x + y) % 3 === 0) b.setPixel(x, y, "#3f6e1b");
      if ((x * 3 + y) % 5 === 0) b.setPixel(x, y, "#5fa02d");
    }
  }

  // Rooftop flowers
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

  // Pavers grid
  for (let i = 0; i < 16; i++) {
    b.setPixel(i, 0, "#b39e84");
    b.setPixel(i, 8, "#b39e84");
    b.setPixel(0, i, "#b39e84");
    b.setPixel(8, i, "#b39e84");
  }

  // Modern metal pergola louvers in center
  b.fillRect(5, 5, 6, 6, "#786550");
  for (let y = 5; y <= 10; y += 2) {
    for (let x = 5; x <= 10; x++) {
      b.setPixel(x, y, "#4a3c2e");
    }
  }

  return b.toImageData();
}

/**
 * Registers all 16-bit textures in the MapLibre Map instance
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
