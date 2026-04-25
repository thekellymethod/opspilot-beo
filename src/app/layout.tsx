import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const marriottDisplay = Playfair_Display({
  variable: "--font-marriott-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "OpsPilot BEO",
  description: "Banquet event operations — decision-ready briefings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${marriottDisplay.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-dvh flex-col bg-brand-night font-sans text-brand-champagne">
        <div
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-20%,rgba(201,168,76,0.08),transparent_55%),radial-gradient(ellipse_70%_40%_at_100%_0%,rgba(107,31,46,0.16),transparent_48%),radial-gradient(ellipse_55%_45%_at_0%_100%,rgba(107,31,46,0.14),transparent_50%),radial-gradient(ellipse_40%_35%_at_85%_85%,rgba(140,45,63,0.1),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 bg-gradient-to-r from-brand-burgundy via-brand-burgundy-glow to-brand-burgundy"
          aria-hidden
        />
        <header className="relative z-50 border-b border-brand-burgundy/25 bg-brand-navy/80 shadow-[inset_0_-1px_0_0_rgba(201,168,76,0.12)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
            <Link href="/" className="group flex items-baseline gap-3">
              <span className="font-display text-xl font-semibold tracking-tight text-brand-champagne sm:text-2xl">
                OpsPilot
              </span>
              <span className="hidden rounded border border-brand-gold/25 bg-brand-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold-bright sm:inline">
                BEO
              </span>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
              {/* Native anchor: full navigation so this always reaches the command center (avoids rare client-router stuck state). */}
              <a
                href="/"
                className="rounded-lg px-3 py-2 text-sm text-brand-muted transition hover:bg-white/5 hover:text-brand-champagne"
              >
                Command
              </a>
              <Link
                href="/dashboard/events"
                className="rounded-lg px-3 py-2 text-sm text-brand-muted transition hover:bg-white/5 hover:text-brand-champagne"
              >
                Events
              </Link>
              <Link
                href="/dashboard/staff"
                className="rounded-lg px-3 py-2 text-sm text-brand-muted transition hover:bg-white/5 hover:text-brand-champagne"
              >
                Staff
              </Link>
              <Link
                href="/upload"
                className="rounded-lg border border-brand-gold/35 bg-brand-gold/10 px-4 py-2 text-sm font-medium text-brand-gold-bright shadow-[0_0_24px_-8px_rgba(201,168,76,0.5)] transition hover:border-brand-gold/55 hover:bg-brand-gold/18"
              >
                Intake
              </Link>
            </nav>
          </div>
        </header>
        <div className="relative z-0 flex flex-1 flex-col shadow-[inset_3px_0_0_0_rgba(107,31,46,0.28)]">{children}</div>
      </body>
    </html>
  );
}
