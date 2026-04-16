import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedAdminUsername } from "@/lib/admin-auth";

export async function GET() {
  try {
    const adminUsername = await getAuthenticatedAdminUsername();
    if (!adminUsername) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [activeEvents, archivedEvents] = await Promise.all([
      prisma.event.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          days: { orderBy: { date: "asc" } },
          participants: {
            include: {
              _count: {
                select: { availabilities: true },
              },
            },
          },
        },
      }),
      prisma.eventArchive.findMany({
        orderBy: { maintenanceDeletedAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      activeEvents: activeEvents.map((event) => ({
        id: event.id,
        title: event.title,
        creatorName: event.creatorName,
        createdAt: event.createdAt,
        timezone: event.timezone,
        firstDate: event.days[0]?.date ?? null,
        lastDate: event.days[event.days.length - 1]?.date ?? null,
        participantCount: event.participants.length,
        availabilityCount: event.participants.reduce((sum, participant) => sum + participant._count.availabilities, 0),
      })),
      archivedEvents,
    });
  } catch (error) {
    console.error("Error listing admin events:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
