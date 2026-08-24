import { NextResponse } from "next/server";
import { getPublicTurnstileConfig } from "@/lib/turnstile";

export async function GET() {
  return NextResponse.json(getPublicTurnstileConfig(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
