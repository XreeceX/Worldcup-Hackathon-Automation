import type { Metadata } from "next";
import { Barlow_Condensed, Figtree } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "react-hot-toast";
import { ClientProviders } from "@/components/ClientProviders";
import { Header } from "@/components/Header";
import { LiveTicker } from "@/components/LiveTicker";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

const display = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "PledgePitch — Social Commitment Engine",
  description:
    "Lock conditional pledges on World Cup matches. Escrowed on Solana, settled trustlessly by TxLINE match proofs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${figtree.variable} ${display.variable} ${geistMono.variable} flex min-h-dvh flex-col font-sans antialiased`}
      >
        <ClientProviders>
          <Header />
          <LiveTicker />
          <main className="app-main flex-1">{children}</main>
          <footer className="app-pad border-t border-edge/60 py-4 text-center text-[11px] text-muted/60">
            Solana devnet · Settlement proven on-chain by TxLINE Merkle proofs ·
            Not a betting product — no counterparty, beneficiary chosen upfront.
          </footer>
        </ClientProviders>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "rgb(var(--raised))",
              color: "rgb(var(--ink))",
              border: "1px solid rgb(var(--edge))",
            },
          }}
        />
      </body>
    </html>
  );
}
