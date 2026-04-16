import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  adminCookieConfig,
  createAdminSessionToken,
  getAdminSetupStatus,
  verifyPassword,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const { adminUsername, requiresSetup } = await getAdminSetupStatus();
    if (requiresSetup) {
      return NextResponse.json({ error: "Admin password is not configured yet" }, { status: 409 });
    }

    const body = await request.json();
    const { username, password } = body as { username?: string; password?: string };

    if (username !== adminUsername || !password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const credential = await prisma.adminCredential.findUnique({ where: { id: "singleton" } });
    if (!credential || !verifyPassword(password, credential.passwordHash)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(adminCookieConfig.name, createAdminSessionToken(adminUsername), adminCookieConfig);
    return response;
  } catch (error) {
    console.error("Error during admin login:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
