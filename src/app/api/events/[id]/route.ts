import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request, context: any) {
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
