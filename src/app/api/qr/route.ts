import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = searchParams.get("data") || "https://radarquest.com.py";
    const dark = searchParams.get("dark") || "#140b29";
    const light = searchParams.get("light") || "#ffffff";

    const svg = await QRCode.toString(data, {
      type: "svg",
      margin: 2,
      width: 360,
      errorCorrectionLevel: "H",
      color: {
        dark,
        light,
      },
    });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : "Error generando QR",
      },
      { status: 500 }
    );
  }
}

