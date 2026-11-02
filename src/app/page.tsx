import Link from "next/link";
import {
  BellRing,
  Camera,
  Compass,
  Flame,
  Gamepad2,
  KeyRound,
  MapPin,
  Radio,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { listActiveBrandsWithPublicMissions } from "@/lib/db/store";
import { BrandIconSvg } from "@/components/icons/BrandIconSvg";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const activeBundles = await listActiveBrandsWithPublicMissions();

  return (
    <div className="min-h-screen bg-[#090414] text-slate-100 relative overflow-hidden">
      <div className="crt-scanlines pointer-events-none fixed inset-0 opacity-30 z-10" />

      <div className="max-w-6xl mx-auto px-4 py-10 md:py-16 relative z-20 space-y-12">
        {/* HERO */}
        <section className="text-center space-y-5 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/80 border border-cyan-400/50 text-cyan-300 font-pixel text-[10px] uppercase">
            <Gamepad2 className="w-4 h-4" />
            <span>SAAS WHITE-LABEL • PARAGUAY NACIONAL (FASE 3)</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white">
            RADAR <span className="text-purple-400">QUEST</span>{" "}
            <span className="text-cyan-300 font-retro">16-BIT</span>
          </h1>

          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Plataforma progresiva (PWA) de Caza del Tesoro QR con Mapa de Calor
            histórico (Heatmap BI), notificaciones Web Push por ciudad para
            nuevos Drops, escáner óptico en HUD y persistencia Cloud PostgreSQL.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/b/el-vape-club"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-slate-950 font-extrabold text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(168,85,247,0.5)] hover:opacity-95 transition inline-flex items-center gap-2"
            >
              <BrandIconSvg iconKey="vape" className="w-5 h-5" />
              <span>Jugar Demo: El Vape Club (Encarnación & Asunción)</span>
            </Link>

            <Link
              href="/b/el-vape-club/admin"
              className="px-5 py-3.5 rounded-xl bg-[#140b29] border-2 border-cyan-400/60 hover:border-cyan-300 text-cyan-300 font-bold text-sm flex items-center gap-2 transition"
            >
              <Radio className="w-4 h-4" />
              <span>Panel Comercio (/b/el-vape-club/admin)</span>
            </Link>

            <Link
              href="/admin"
              className="px-5 py-3.5 rounded-xl bg-[#140b29] border border-purple-500/40 hover:border-purple-400 text-purple-200 font-bold text-sm flex items-center gap-2 transition"
            >
              <Compass className="w-4 h-4" />
              <span>Super-Admin CeroUno (/admin)</span>
            </Link>
          </div>
        </section>

        {/* ACTIVE MULTI-TENANT INSTANCES */}
        <section className="space-y-4">
          <h2 className="font-pixel text-xs uppercase text-amber-300 text-center">
            INSTANCIAS MULTIMARCA ACTIVAS EN DEMO
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {activeBundles.map(({ brand, missions }) => {
              const cities = Array.from(new Set(missions.map((m) => m.city)));

              return (
                <div
                  key={brand.id}
                  className="p-6 rounded-2xl bg-[#140b29]/95 border-2 flex flex-col justify-between gap-5 shadow-xl"
                  style={{ borderColor: brand.primaryColor }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl border flex items-center justify-center text-cyan-300 shrink-0"
                          style={{
                            borderColor: brand.primaryColor,
                            backgroundColor: `${brand.primaryColor}22`,
                          }}
                        >
                          <BrandIconSvg
                            iconKey={brand.logoEmoji}
                            className="w-6 h-6"
                          />
                        </div>
                        <div>
                          <h3 className="text-xl font-extrabold text-white">
                            {brand.name}
                          </h3>
                          <p className="text-xs text-slate-400">
                            {brand.tagline}
                          </p>
                        </div>
                      </div>
                      {brand.requireAdult18 ? (
                        <span className="px-2 py-1 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                          +18 ACTIVO
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-emerald-400 text-slate-950 text-[10px] font-extrabold">
                          ATP FAMILIAR
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {cities.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0b0518] border border-purple-500/40 text-xs text-cyan-300"
                        >
                          <MapPin className="w-3 h-3" />
                          {c}
                        </span>
                      ))}
                      <span className="px-2.5 py-1 rounded-md bg-[#0b0518] text-xs text-slate-300">
                        {missions.length} misiones configuradas
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href={`/b/${brand.slug}`}
                      className="py-2.5 px-3 rounded-xl text-center font-extrabold text-xs uppercase text-slate-950"
                      style={{ backgroundColor: brand.secondaryColor }}
                    >
                      Entrar al Radar (/b/{brand.slug})
                    </Link>
                    <Link
                      href={`/b/${brand.slug}/admin`}
                      className="py-2.5 px-3 rounded-xl text-center font-bold text-xs uppercase bg-[#0b0518] border border-purple-500/50 text-white hover:border-cyan-400 flex items-center justify-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                      <span>Admin PIN 6 Díg</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ARCHITECTURE HIGHLIGHTS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#140b29]/80 border border-purple-500/30 space-y-2">
            <Flame className="w-6 h-6 text-rose-400" />
            <h3 className="font-bold text-sm text-white">
              Heatmap & Inteligencia BI
            </h3>
            <p className="text-xs text-slate-400">
              Capa de densidad de HunterPing en MapLibre y tarjetas arcade con
              cazadores únicos, tiempo medio de captura y conversión.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#140b29]/80 border border-purple-500/30 space-y-2">
            <BellRing className="w-6 h-6 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">
              Web Push Drops por Ciudad
            </h3>
            <p className="text-xs text-slate-400">
              Suscripción PushManager + Service Worker asociada a ciudad y marca,
              disparada en segundo plano al activar cada misión.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#140b29]/80 border border-purple-500/30 space-y-2">
            <Camera className="w-6 h-6 text-amber-300" />
            <h3 className="font-bold text-sm text-white">
              Escáner In-App Retro-Arcade
            </h3>
            <p className="text-xs text-slate-400">
              Se habilita en ¡QUEMANDO! (&lt;30m y &lt;20 km/h) con mira neón,
              BarcodeDetector API + jsQR sin perder Screen Wake Lock.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#140b29]/80 border border-purple-500/30 space-y-2">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <h3 className="font-bold text-sm text-white">
              Prisma + PostgreSQL Cloud
            </h3>
            <p className="text-xs text-slate-400">
              Compatible con Neon y Supabase mediante DATABASE_URL con victoria
              atómica ($transaction) e índices de telemetría.
            </p>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-500 pt-4 flex items-center justify-center gap-2">
          <Smartphone className="w-4 h-4 text-purple-400" />
          <span>
            Desarrollado por <strong className="text-slate-300">CeroUno Studio</strong>{" "}
            • Radar Quest Paraguay PWA
          </span>
        </footer>
      </div>
    </div>
  );
}
