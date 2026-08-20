import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { AppShell } from "./app-shell";
import "./globals.css";

// Weight lists are the actual set used app-wide (checked via a grep for every
// font-medium/font-semibold/font-bold/font-normal in the codebase, plus the
// unweighted default), not the full variable range - self-hosted, no CDN.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// UI sans is 400/500/600 only - the app's one font-bold (700) lands on the
// net worth headline, a figure, so it belongs to the mono weight set instead.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Wordmark-only face, bold weight only - never used for body text, numeric
// figures, or anywhere outside the login page's "MoneyLeft" wordmark.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "MoneyLeft",
  description: "A personal net worth tracker with an AI-valued asset vault.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
