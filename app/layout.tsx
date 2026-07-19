import type { Metadata } from "next";
import { Special_Elite, IBM_Plex_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import NavLink from "@/components/NavLink";

const display = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});
const body = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Things I Don't Want to Forget",
  description: "A personal Today-I-Learned notebook.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen font-body">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <header className="mb-10 flex items-baseline justify-between border-b border-cork-light/60 pb-4">
            <a href="/" className="font-display text-2xl tracking-tight text-card">
              til<span className="text-thread">/</span>
            </a>
            <nav className="font-mono text-xs uppercase tracking-widest text-muted">
              <NavLink href="/" label="board" />
              <span className="mx-3 text-cork-light">·</span>
              <NavLink href="/til" label="index" />
              <span className="mx-3 text-cork-light">·</span>
              <NavLink href="/admin" label="+ new" />
            </nav>
          </header>
          {children}
          <footer className="mt-16 border-t border-cork-light/60 pt-4 font-mono text-[11px] text-muted">
            When a topic deserves a deeper dive, I write about it on my blog. Feel free
            to explore the longer posts at{" "}
            <a
              href="https://sameeramperera.me/posts"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              sameeramperera.me/posts
            </a>
            .
          </footer>
        </div>
      </body>
    </html>
  );
}
