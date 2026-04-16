import { NextResponse } from "next/server";
import { getAdminSetupStatus, getAuthenticatedAdminUsername } from "@/lib/admin-auth";

export async function GET() {
  try {
    const { requiresSetup } = await getAdminSetupStatus();
    const authenticatedUsername = await getAuthenticatedAdminUsername();

    return NextResponse.json({
      requiresSetup,
      authenticated: Boolean(authenticatedUsername),
    });
  } catch (error) {
    console.error("Error checking admin status:", error);
    return NextResponse.json({ error: "Admin configuration is invalid" }, { status: 500 });
  }
}
