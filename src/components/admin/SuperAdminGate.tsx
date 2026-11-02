"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound, Lock, Sparkles } from "lucide-react";

export function SuperAdminGate() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/super-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "Token maestro inválido.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red validando ADMIN_SECRET.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#090414] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl p-6 bg-[#140b29] border-2 border-purple-500/60 shadow-[0_0_50px_rgba(168,85,247,0.3)] space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/50 flex items-center justify-center mx-auto text-amber-300">
            <Sparkles className="w-6 h-6" />
          </div>
          <p className="font-pixel text-[9px] text-cyan-300 uppercase">
            CEROUNO STUDIO • CONSOLA CENTRAL
          </p>
          <h1 className="text-2xl font-extrabold text-white">
            Acceso Super-Admin
          </h1>
          <p className="text-xs text-slate-400">
            Protegido mediante Token Maestro validado contra{" "}
            <code className="text-cyan-300">ADMIN_SECRET</code>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] uppercase font-bold text-slate-300 mb-1.5">
              Token Maestro (ADMIN_SECRET)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                placeholder="Ingresá ADMIN_SECRET..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#090314] border border-purple-500/50 text-sm font-mono text-cyan-200 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-950/90 border border-red-500 text-xs text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:opacity-95 text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
          >
            {loading ? "VALIDANDO TOKEN MAESTRO..." : "DESBLOQUEAR INFRAESTRUCTURA"}
          </button>
        </form>

        <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between text-xs text-slate-400">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver al Portal</span>
          </Link>
          {process.env.NODE_ENV !== "production" && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-mono">
              <KeyRound className="w-3 h-3" />
              <span>Dev: CEROUNO-MASTER-2026</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

