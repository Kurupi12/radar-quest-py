import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Radar Quest PY • Caza del Tesoro QR 16-Bit",
    short_name: "Radar Quest",
    description:
      "Plataforma urbana de búsqueda del tesoro QR con radar térmico Arcade 16-bits en todo Paraguay.",
    start_url: "/b/el-vape-club",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0722",
    theme_color: "#a855f7",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

