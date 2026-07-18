import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "react-hot-toast";
import { ClientProviders } from "@/components/ClientProviders";
import { Header } from "@/components/Header";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
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
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ClientProviders>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-center text-xs text-muted/70 sm:px-6">
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
