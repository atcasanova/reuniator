import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createParticipantSessionToken,
  isTurnstileEnabled,
  participantCookieConfig,
  turnstileActions,
  verifyTurnstileToken,
} from "@/lib/turnstile";


export async function POST(request: Request, context: RouteContext<'/api/events/[id]/participants'>) {
  try {
    const params = await context.params;
    const { id } = params;
    const body = await request.json();
    const { name, turnstileToken, turnstileAction } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (isTurnstileEnabled() && turnstileAction !== turnstileActions.joinEvent) {
      return NextResponse.json({ error: "Invalid security challenge" }, { status: 400 });
    }

    const turnstile = await verifyTurnstileToken(request, turnstileToken, turnstileActions.joinEvent);
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error }, { status: turnstile.status });
    }

    // Check if participant already exists for this name in this event
    const existing = await prisma.participant.findFirst({
      where: {
        eventId: id,
        name: name,
      }
    });

    if (existing) {
      const response = NextResponse.json({ participant: existing });
      response.cookies.set({
        ...participantCookieConfig,
        value: createParticipantSessionToken(id, existing.id),
      });
      return response;
    }

    const participant = await prisma.participant.create({
      data: {
        name,
        eventId: id,
      },
    });

    const response = NextResponse.json({ participant }, { status: 201 });
    response.cookies.set({
      ...participantCookieConfig,
      value: createParticipantSessionToken(id, participant.id),
    });
    return response;
  } catch (error) {
    console.error("Error adding participant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
