import {
  Flame,
  Gamepad2,
  Gem,
  Radar,
  Trophy,
  Utensils,
  Wind,
  Zap,
} from "lucide-react";

export const BRAND_ICON_OPTIONS = [
  { id: "vape", label: "Vapor / Club (Wind SVG)" },
  { id: "burger", label: "Gastronomía (Utensils SVG)" },
  { id: "gamepad", label: "Arcade / Gaming (Gamepad SVG)" },
  { id: "bolt", label: "Energía / Bebidas (Zap SVG)" },
  { id: "flame", label: "Urbano / Drop (Flame SVG)" },
  { id: "gem", label: "Moda / Retail VIP (Gem SVG)" },
  { id: "trophy", label: "Torneo / Eventos (Trophy SVG)" },
  { id: "radar", label: "Radar Oficial (Radar SVG)" },
] as const;

interface BrandIconSvgProps {
  iconKey?: string | null;
  className?: string;
  color?: string;
}

/**
 * Renders 100% pure SVG brand iconography (zero emojis in UI).
 * Automatically maps legacy seed identifiers to crisp vector SVG icons.
 */
export function BrandIconSvg({
  iconKey,
  className = "w-6 h-6",
  color,
}: BrandIconSvgProps) {
  const normalized = (iconKey || "radar").trim().toLowerCase();
  const style = color ? { color } : undefined;

  if (normalized === "vape" || normalized === "💨") {
    return <Wind className={className} style={style} />;
  }
  if (normalized === "burger" || normalized === "🍔") {
    return <Utensils className={className} style={style} />;
  }
  if (normalized === "gamepad" || normalized === "🕹️") {
    return <Gamepad2 className={className} style={style} />;
  }
  if (normalized === "bolt" || normalized === "⚡") {
    return <Zap className={className} style={style} />;
  }
  if (normalized === "flame" || normalized === "🔥") {
    return <Flame className={className} style={style} />;
  }
  if (normalized === "gem") {
    return <Gem className={className} style={style} />;
  }
  if (normalized === "trophy") {
    return <Trophy className={className} style={style} />;
  }

  return <Radar className={className} style={style} />;
}

