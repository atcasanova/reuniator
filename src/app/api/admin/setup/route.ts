import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdminSessionToken, adminCookieConfig, getAdminSetupStatus, hashPasswordForStorage } from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const { adminUsername, requiresSetup } = await getAdminSetupStatus();
    if (!requiresSetup) {
      return NextResponse.json({ error: "Admin password has already been configured" }, { status: 409 });
    }

    const body = await request.json();
    const { username, password } = body as { username?: string; password?: string };

    if (username !== adminUsername) {
      return NextResponse.json({ error: "Invalid admin user" }, { status: 401 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const passwordHash = hashPasswordForStorage(password);

    await prisma.adminCredential.create({
      data: {
        id: "singleton",
        passwordHash,
      },
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(adminCookieConfig.name, createAdminSessionToken(adminUsername), adminCookieConfig);

    return response;
  } catch (error) {
    console.error("Error configuring admin password:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
