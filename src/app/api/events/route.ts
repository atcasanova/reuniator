import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isTurnstileEnabled, turnstileActions, verifyTurnstileToken } from "@/lib/turnstile";


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      creatorName,
      dates,
      timeRangeStart,
      timeRangeEnd,
      timezone,
      turnstileToken,
      turnstileAction,
    } = body;

    if (!title || !creatorName || !dates || dates.length === 0 || !timeRangeStart || !timeRangeEnd) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (isTurnstileEnabled() && turnstileAction !== turnstileActions.createEvent) {
      return NextResponse.json({ error: "Invalid security challenge" }, { status: 400 });
    }

    const turnstile = await verifyTurnstileToken(request, turnstileToken, turnstileActions.createEvent);
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error }, { status: turnstile.status });
    }

    const event = await prisma.event.create({
      data: {
        title,
        creatorName,
        timezone: timezone || "UTC",
        timeRangeStart,
        timeRangeEnd,
        days: {
          create: dates.map((date: string) => ({
            date,
          })),
        },
      },
      include: {
        days: true,
      },
    });

    return NextResponse.json({ id: event.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
