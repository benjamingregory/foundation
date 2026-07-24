import type { Metadata } from "next";
import {
  Instrument_Sans,
  Newsreader,
  Geist_Mono,
  Host_Grotesk,
} from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  subsets: ["latin"],
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Wordmark only — loaded at 700 alone; nothing else on the page uses it.
const hostGrotesk = Host_Grotesk({
  variable: "--font-host-grotesk",
  weight: ["700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "foundation",
  description: "foundation starter app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${newsreader.variable} ${geistMono.variable} ${hostGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
