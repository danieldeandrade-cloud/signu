"use client";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "@/lib/msalInstance";
export default function MsalWrapper({ children }: { children: React.ReactNode }) {
  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
