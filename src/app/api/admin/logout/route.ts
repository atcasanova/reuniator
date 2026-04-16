import { NextResponse } from "next/server";
import { adminCookieConfig } from "@/lib/admin-auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(adminCookieConfig.name, "", {
    ...adminCookieConfig,
    maxAge: 0,
  });

  return response;
}
