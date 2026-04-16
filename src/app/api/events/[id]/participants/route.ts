import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function POST(request: Request, context: RouteContext<'/api/events/[id]/participants'>) {
  try {
    const params = await context.params;
    const { id } = params;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Check if participant already exists for this name in this event
    const existing = await prisma.participant.findFirst({
      where: {
        eventId: id,
        name: name,
      }
    });

    if (existing) {
      return NextResponse.json({ participant: existing });
    }

    const participant = await prisma.participant.create({
      data: {
        name,
        eventId: id,
      },
    });

    return NextResponse.json({ participant }, { status: 201 });
  } catch (error) {
    console.error("Error adding participant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
