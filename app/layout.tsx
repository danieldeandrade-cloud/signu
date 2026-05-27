import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGNU — NULEJ/TJDFT",
  description: "Sistema de Gestão de Bens",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
