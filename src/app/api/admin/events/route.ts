import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedAdminUsername } from "@/lib/admin-auth";

type ArchivedEventRow = {
  id: string;
  originalEventId: string;
  title: string;
  creatorName: string;
  timezone: string;
  createdAt: string | number | bigint | Date;
  lastScheduledDate: string | null;
  participantCount: number | bigint;
  availabilityCount: number | bigint;
  maintenanceDeletedAt: string | number | bigint | Date;
};

function normalizeDateValue(value: string | number | bigint | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return new Date(Number(value)).toISOString();
  }

  if (typeof value === "number") {
    return new Date(value).toISOString();
  }

  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && value.trim() !== "") {
    return new Date(numericValue).toISOString();
  }

  return new Date(value).toISOString();
}

function normalizeCount(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

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
      prisma.$queryRaw<ArchivedEventRow[]>`
        SELECT
          id,
          originalEventId,
          title,
          creatorName,
          timezone,
          createdAt,
          lastScheduledDate,
          participantCount,
          availabilityCount,
          maintenanceDeletedAt
        FROM EventArchive
      `,
    ]);

    const normalizedArchivedEvents = archivedEvents
      .map((event) => ({
        id: event.id,
        originalEventId: event.originalEventId,
        title: event.title,
        creatorName: event.creatorName,
        timezone: event.timezone,
        createdAt: normalizeDateValue(event.createdAt),
        lastScheduledDate: event.lastScheduledDate,
        participantCount: normalizeCount(event.participantCount),
        availabilityCount: normalizeCount(event.availabilityCount),
        maintenanceDeletedAt: normalizeDateValue(event.maintenanceDeletedAt),
      }))
      .sort((a, b) => +new Date(b.maintenanceDeletedAt) - +new Date(a.maintenanceDeletedAt));

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
      archivedEvents: normalizedArchivedEvents,
    });
  } catch (error) {
    console.error("Error listing admin events:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
