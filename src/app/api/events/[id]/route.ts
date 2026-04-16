import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(request: Request, context: RouteContext<'/api/events/[id]'>) {
  try {
    const params = await context.params;
    const { id } = params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        days: {
          orderBy: { date: 'asc' },
        },
        participants: {
          include: {
            availabilities: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
