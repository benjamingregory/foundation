import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";

import type { Metadata } from "next";

import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "foundation",
    template: "%s | foundation",
  },
  description:
    "foundation is a Next.js starter with Supabase auth, Postgres, Mastra agents, Stripe billing, and Resend email already wired together.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
