import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request, context: any) {
  try {
    const params = await context.params;
    const { id } = params;
    const body = await request.json();
    const { participantId, availabilities } = body; 
    // availabilities is an array of { date: string, time: string }

    if (!participantId || !Array.isArray(availabilities)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Verify participant belongs to this event
    const participant = await prisma.participant.findUnique({
      where: { id: participantId }
    });

    if (!participant || participant.eventId !== id) {
      return NextResponse.json({ error: "Participant not found or invalid event" }, { status: 404 });
    }

    // Overwrite all availabilities for this participant
    // Since SQLite with Prisma might require sequential operations or a transaction:
    await prisma.$transaction([
      prisma.availability.deleteMany({
        where: { participantId }
      }),
      prisma.availability.createMany({
        data: availabilities.map((a: { date: string; time: string }) => ({
          participantId,
          date: a.date,
          time: a.time,
        }))
      })
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error updating availabilities:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
