import type { Metadata } from "next";
import "./globals.css";
import NextAuthProvider from "@/components/NextAuthProvider";

export const metadata: Metadata = {
  title: "SIGNU — NULEJ/TJDFT",
  description: "Sistema de Gestão de Bens",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0 }}>
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}
