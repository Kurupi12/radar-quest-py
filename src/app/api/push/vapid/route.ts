import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push/webPush";

export async function GET() {
  return NextResponse.json({
    ok: true,
    publicKey: getVapidPublicKey(),
  });
}

