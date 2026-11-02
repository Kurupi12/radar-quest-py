import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "localhost",
  "radar-quest",
]);

/**
 * Multi-Tenant White-Label Subdomain Router (Next.js 16 Proxy)
 * - Root domain /admin        -> Super-Admin CeroUno Studio (/admin)
 * - Path /b/[brand]/admin     -> Merchant PIN Panel
 * - Subdomain [brand].domain  -> Rewrites / to /b/[brand] and /admin to /b/[brand]/admin
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/b/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (!host || host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return NextResponse.next();
  }

  let subdomain: string | null = null;
  if (host.endsWith(".localhost")) {
    subdomain = host.replace(/\.localhost$/, "");
  } else {
    const parts = host.split(".");
    if (parts.length >= 3 && !host.endsWith(".vercel.app")) {
      subdomain = parts[0];
    }
  }

  if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/b/${subdomain}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
