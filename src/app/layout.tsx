import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  metadataBase: new URL("https://reuniator.bru.to"),
  title: "Reuniator | Encontre o melhor horário para reuniões",
  description:
    "Crie enquetes de disponibilidade, compartilhe um link e descubra a melhor data e horário para reuniões, eventos e encontros em grupo.",
  keywords: [
    "agendar reunião",
    "marcar reunião",
    "enquete de disponibilidade",
    "organizar encontro",
    "planejar evento",
    "agenda colaborativa",
    "melhor horário para reunião",
    "Reuniator",
  ],
  openGraph: {
    title: "Reuniator | Encontre o melhor horário para reuniões",
    description:
      "Crie enquetes de disponibilidade, compartilhe um link e descubra a melhor data e horário para reuniões, eventos e encontros em grupo.",
    url: "https://reuniator.bru.to",
    siteName: "Reuniator",
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary",
    title: "Reuniator | Encontre o melhor horário para reuniões",
    description:
      "Crie enquetes de disponibilidade, compartilhe um link e descubra a melhor data e horário para reuniões, eventos e encontros em grupo.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
