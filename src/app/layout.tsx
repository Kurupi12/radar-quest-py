import type { Metadata, Viewport } from "next";
import { Handjet, Press_Start_2P, Space_Grotesk, VT323 } from "next/font/google";
import { PwaRegistrar } from "@/components/PwaRegistrar";
import "./globals.css";

const handjet = Handjet({
  subsets: ["latin"],
  variable: "--font-handjet",
  display: "swap",
});

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Radar Quest PY • Caza del Tesoro QR Arcade 16-Bit",
  description:
    "Plataforma SaaS White-Label de Caza del Tesoro QR con radar térmico en tiempo real para marcas y eventos urbanos en todo Paraguay.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Radar Quest",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#140b29",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${pressStart.variable} ${vt323.variable} ${spaceGrotesk.variable} ${handjet.variable}`}
    >
      <head>
        <link rel="preload" href="/audio/bgm.mp3" as="audio" type="audio/mpeg" />
        <link
          rel="preload"
          href="/audio/bgm_tension.mp3"
          as="audio"
          type="audio/mpeg"
        />
        <link
          rel="preload"
          href="/audio/bgm_climax.mp3"
          as="audio"
          type="audio/mpeg"
        />
        <link
          rel="preload"
          href="/audio/sfx_freeze.mp3"
          as="audio"
          type="audio/mpeg"
        />
      </head>
      <body className="antialiased selection:bg-purple-500 selection:text-white font-[family-name:var(--font-space)]">
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}

