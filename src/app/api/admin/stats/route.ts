import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedAdminUsername } from "@/lib/admin-auth";

export async function GET() {
  try {
    const adminUsername = await getAuthenticatedAdminUsername();
    if (!adminUsername) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [activeEventCount, archivedEventCount, activeParticipants, activeAvailabilities, archivedAgg] = await Promise.all([
      prisma.event.count(),
      prisma.eventArchive.count(),
      prisma.participant.count(),
      prisma.availability.count(),
      prisma.eventArchive.aggregate({
        _sum: {
          participantCount: true,
          availabilityCount: true,
        },
      }),
    ]);

    return NextResponse.json({
      activeEventCount,
      archivedEventCount,
      totalEventsEver: activeEventCount + archivedEventCount,
      activeParticipants,
      activeAvailabilities,
      archivedParticipants: archivedAgg._sum.participantCount ?? 0,
      archivedAvailabilities: archivedAgg._sum.availabilityCount ?? 0,
      totalParticipantsEver: activeParticipants + (archivedAgg._sum.participantCount ?? 0),
      totalAvailabilitiesEver: activeAvailabilities + (archivedAgg._sum.availabilityCount ?? 0),
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
