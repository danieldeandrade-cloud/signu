"use client";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const GESTORES = ['danieldeandrade.pessoal@gmail.com', 'carlosalex1318@gmail.com'];

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
    somenteGestor: true,
  },
  {
    href: "/gestao",
    label: "Gestão",
    icon: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    somenteGestor: true,
  },
  {
    href: "/busca",
    label: "Busca Global",
    icon: "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  },
  {
    href: "/anotacoes",
    label: "Anotações",
    icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    somenteGestor: true,
  },
];

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: session } = useSession();

  const emailUsuario = (session?.user?.email || "").toLowerCase();
  const isGestor     = GESTORES.includes(emailUsuario);

  const nomeExibir = session?.user?.name || user?.displayName || "";
  const fotoUrl    = session?.user?.image || null;
  const initials   = nomeExibir
    ? nomeExibir.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "??";

  const itensVisiveis = NAV_ITEMS.filter(item => !item.somenteGestor || isGestor);

  return (
    <aside className="signu-sidebar">
      {/* Logo */}
      <div
        className="signu-sidebar-logo"
        onClick={() => router.push("/inicio")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 16px",
          marginBottom: 16,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "#2563eb",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8.5L8.5 2L13.5 7L7 13.5L2 8.5Z"/>
            <path d="M10.5 10.5L19 19"/>
            <path d="M5 21h14"/>
          </svg>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>SIGNU</span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "0 12px 10px" }}/>

      {/* Nav items */}
      {itensVisiveis.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <button
            key={href}
            title={label}
            onClick={() => router.push(href)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 14px",
              height: 40,
              margin: "0 8px",
              borderRadius: 8,
              border: "none",
              background: active ? "#2563eb" : "transparent",
              color: active ? "#fff" : "rgba(255,255,255,0.5)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              outline: "none",
              flexShrink: 0,
              width: "calc(100% - 16px)",
              textAlign: "left",
              position: "relative",
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                e.currentTarget.style.color = "#fff";
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "rgba(255,255,255,0.5)";
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0 }}>
              <path d={icon}/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: active ? 600 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {label}
            </span>
          </button>
        );
      })}

      {/* Spacer */}
      <div className="signu-sidebar-spacer" style={{ flex: 1 }}/>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "0 12px 10px" }}/>

      {/* Avatar */}
      <div className="signu-sidebar-avatar" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px" }}>
        {fotoUrl ? (
          <img
            src={fotoUrl}
            alt={nomeExibir}
            title={nomeExibir}
            style={{ width: 30, height: 30, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.2)", cursor: "default", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div
            title={nomeExibir || "Usuário"}
            style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "#2563eb",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff", cursor: "default", flexShrink: 0,
            }}
          >{initials}</div>
        )}
        <div style={{ overflow: "hidden" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {nomeExibir.split(" ")[0] || "Usuário"}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
            {isGestor ? "Gestor" : "Servidor"}
          </div>
        </div>
      </div>
    </aside>
  );
}
