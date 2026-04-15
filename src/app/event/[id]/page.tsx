import type { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import EventPageClient from "./event-page-client";

type EventPageProps = {
  params: Promise<{ id: string }>;
};

const prisma = new PrismaClient();

const defaultMeetingDescription =
  "Informe seus horários disponíveis e encontre o melhor horário para todos.";

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { title: true },
  });

  const eventTitle = event?.title?.trim() || "Reunião";
  const eventUrl = `https://reuniator.bru.to/event/${id}`;

  return {
    title: `${eventTitle} | Reuniator`,
    description: defaultMeetingDescription,
    openGraph: {
      title: eventTitle,
      description: defaultMeetingDescription,
      url: eventUrl,
      siteName: "Reuniator",
      type: "website",
      locale: "pt_BR",
    },
  };
}

export default function EventPage() {
  return <EventPageClient />;
}
