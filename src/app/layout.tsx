import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeWrapper } from "./theme-wrapper";
import { Law25ConsentBanner } from "@/components/Law25ConsentBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Planxo — Planification de rendez-vous simplifiée | RDV en ligne Québec",
  description: "L'outil de planification #1 pour les professionnels québécois. Connectez vos calendriers, partagez votre lien et laissez vos clients réserver en ligne.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeWrapper>{children}</ThemeWrapper>
        <Law25ConsentBanner />
      </body>
    </html>
  );
}
