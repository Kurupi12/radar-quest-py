"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Delete, KeyRound, ShieldCheck } from "lucide-react";
import type { PublicBrand } from "@/types/radar";
import { BrandIconSvg } from "@/components/icons/BrandIconSvg";

interface BrandPinGateProps {
  brand: PublicBrand;
}

export function BrandPinGate({ brand }: BrandPinGateProps) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPin = async (candidatePin: string) => {
    if (candidatePin.length !== 6) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/brand-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandSlug: brand.slug,
          pin: candidatePin,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "PIN incorrecto.");
        setPin("");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Error de red verificando PIN.");
      setLoading(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (loading || pin.length >= 6) return;
    const next = `${pin}${digit}`;
    setPin(next);
    setError(null);
    if (next.length === 6) {
      submitPin(next);
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  return (
    <div className="min-h-[100dvh] bg-[#090414] text-white flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-2xl p-6 bg-[#140b29] border-2 shadow-2xl space-y-5"
        style={{
          borderColor: brand.primaryColor,
          boxShadow: `0 0 40px ${brand.primaryColor}33`,
        }}
      >
        <div className="text-center space-y-1.5">
          <div
            className="w-14 h-14 rounded-2xl border-2 flex items-center justify-center mx-auto mb-2 text-cyan-300"
            style={{
              borderColor: brand.primaryColor,
              backgroundColor: `${brand.primaryColor}22`,
            }}
          >
            <BrandIconSvg iconKey={brand.logoEmoji} className="w-7 h-7" />
          </div>
          <p
            className="font-pixel text-[9px] uppercase"
            style={{ color: brand.secondaryColor }}
          >
            ACCESO COMERCIO • PIN 6 DÍGITOS
          </p>
          <h1 className="text-xl font-extrabold text-white">{brand.name}</h1>
          <p className="text-xs text-slate-400">
            Ingresá el PIN numérico de 6 dígitos de tu marca para desbloquear
            misiones, Live Command Center y leads.
          </p>
        </div>

        {/* 6-Digit Arcade Slots */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: 6 }).map((_, idx) => {
            const filled = idx < pin.length;
            return (
              <div
                key={idx}
                className="w-10 h-12 rounded-lg bg-[#090314] border-2 flex items-center justify-center font-mono text-xl font-extrabold transition"
                style={{
                  borderColor: filled ? brand.secondaryColor : "#334155",
                  color: brand.secondaryColor,
                }}
              >
                {filled ? "●" : ""}
              </div>
            );
          })}
        </div>

        {/* Direct Keyboard Input Support */}
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => {
            const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 6);
            setPin(digitsOnly);
            if (digitsOnly.length === 6) submitPin(digitsOnly);
          }}
          placeholder="También podés tipear el PIN aquí"
          className="w-full px-3 py-2 rounded-lg bg-[#090314] border border-purple-500/40 text-center text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
        />

        {/* Retro Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              disabled={loading}
              onClick={() => handleDigit(d)}
              className="py-3 rounded-xl bg-[#0c051c] hover:bg-purple-900/50 border border-purple-500/40 font-mono text-lg font-extrabold text-white active:scale-95 transition cursor-pointer"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            disabled={loading}
            onClick={() => setPin("")}
            className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-400 cursor-pointer"
          >
            LIMPIAR
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleDigit("0")}
            className="py-3 rounded-xl bg-[#0c051c] hover:bg-purple-900/50 border border-purple-500/40 font-mono text-lg font-extrabold text-white active:scale-95 transition cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleBackspace}
            className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-950/90 border border-red-500 text-xs text-red-200 text-center">
            {error}
          </div>
        )}

        <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between text-[11px] text-slate-400">
          <Link
            href={`/b/${brand.slug}`}
            className="inline-flex items-center gap-1 hover:text-cyan-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver al Radar</span>
          </Link>
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Cookie brand_session</span>
          </span>
        </div>

        {process.env.NODE_ENV !== "production" && (
          <div className="p-2 rounded bg-purple-950/40 border border-purple-500/30 text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
            <KeyRound className="w-3 h-3 text-amber-300" />
            <span>
              Demo PIN ({brand.slug}):{" "}
              <strong className="text-amber-300 font-mono">
                {brand.slug === "arcade-burger" ? "161616" : "420420"}
              </strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

