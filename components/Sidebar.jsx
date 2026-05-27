"use client";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/inicio",
    label: "Início",
    icon: "M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z M9 22V12h6v10",
  },
  {
    href: "/fila",
    label: "Minha Fila",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
  {
    href: "/cadastro",
    label: "Cadastro",
    icon: "M12 5v14M5 12h14",
  },
  {
    href: "/gestao",
    label: "Gestão",
    icon: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  },
  {
    href: "/busca",
    label: "Busca Global",
    icon: "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  },
];

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router   = useRouter();

  const initials = user?.displayName
    ? user.displayName.split(" ").map(w => w[0]).slice(0, 2).join("")
    : "CA";

  return (
    <aside style={{
      width: 64,
      background: "#0a1628",
      borderRight: "1px solid rgba(201,168,76,0.1)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "20px 0",
      gap: 6,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div
        onClick={() => router.push("/inicio")}
        style={{
          width: 36, height: 36, borderRadius: 8,
          background: "linear-gradient(135deg,#c9a84c,#8b6914)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, color: "#0a1628", marginBottom: 10, cursor: "pointer",
        }}
        title="SIGNU — Início"
      >⚖</div>

      {/* Nav items */}
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <button
            key={href}
            title={label}
            onClick={() => router.push(href)}
            style={{
              width: 40, height: 40, borderRadius: 8, border: "none",
              background: active ? "rgba(201,168,76,0.12)" : "transparent",
              color: active ? "#c9a84c" : "rgba(255,255,255,0.3)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s ease",
              outline: "none",
            }}
            onMouseEnter={e => {
              if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            }}
            onMouseLeave={e => {
              if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.3)";
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={icon}/>
            </svg>
          </button>
        );
      })}

      <div style={{ flex: 1 }}/>

      {/* Avatar do usuário */}
      <div
        title={user?.displayName || "Carla Araújo"}
        style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg,#1e40af,#3b82f6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff", cursor: "default",
        }}
      >{initials}</div>
    </aside>
  );
}