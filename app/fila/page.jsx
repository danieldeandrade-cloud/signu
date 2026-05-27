"use client";
import Sidebar from "@/components/Sidebar";

import { useState } from "react";

// ─── MOCK DATA (espelha estrutura real das 9 listas SharePoint) ───────────────
const mockUser = {
  displayName: "Carla Araújo",
  email: "carla.araujo@tjdft.jus.br",
  initials: "CA",
};

const mockQueue = [
  {
    id: "CEGOC-0142",
    ID_PASEI: "0038491-22.2024.8.07.0001",
    TIPO_BEM: "CARRO",
    NIV: "9BWZZZ377VT004251",
    STATUS_DILIGENCIA: "EM DILIGÊNCIA",
    DESTINACAO: "EM DILIGÊNCIA HIGEIA",
    listaOrigem: "CEGOC",
    diasSemAtualizacao: 12,
    OBSERVACOES: "Veículo aguardando expedição FIB para transferência HIGEIA.",
    FIB: false,
  },
  {
    id: "CEGOC-0087",
    ID_PASEI: "0019273-55.2023.8.07.0015",
    TIPO_BEM: "MOTO",
    NIV: "9C2JC4110LR501234",
    STATUS_DILIGENCIA: "ATRASADO",
    DESTINACAO: "LPC",
    listaOrigem: "CEGOC",
    diasSemAtualizacao: 34,
    OBSERVACOES: "Pendente retorno do leiloeiro oficial.",
    FIB: false,
  },
  {
    id: "PCDF1-0331",
    ID_PASEI: "0054812-11.2022.8.07.0003",
    TIPO_BEM: "CAMINHONETE",
    NIV: "8AFZZZ3CZGE123456",
    STATUS_DILIGENCIA: "AGUARDANDO",
    DESTINACAO: "SELAB/PCDF",
    listaOrigem: "PCDF_1HIGEIA",
    diasSemAtualizacao: 5,
    OBSERVACOES: "CEB_TEP_TIV emitido. Aguardando ofício de baixa.",
    FIB: true,
  },
  {
    id: "DPJ-0049",
    ID_PASEI: "0002341-88.2021.8.07.0020",
    TIPO_BEM: "CARRO",
    NIV: "1HGBH41JXMN109186",
    STATUS_DILIGENCIA: "PRAZO 6 MESES",
    DESTINACAO: "DETERIORADO",
    listaOrigem: "DPJ_GC99",
    diasSemAtualizacao: 8,
    LOTE: 49,
    OBSERVACOES: "Prazo de 6 meses a vencer em 3 dias. Prioridade máxima.",
    FIB: false,
  },
  {
    id: "PCDF2-0201",
    ID_PASEI: "0071009-44.2024.8.07.0007",
    TIPO_BEM: "CAMINHÃO",
    NIV: "9BM379182LB755000",
    STATUS_DILIGENCIA: "EM DILIGÊNCIA",
    DESTINACAO: "CPA/PCDF",
    listaOrigem: "PCDF_2HIGEIA",
    diasSemAtualizacao: 19,
    RESTRICAO_ROUBO: true,
    OBSERVACOES: "Restrição roubo/furto ativa. Aguardando PA TJDFT.",
    FIB: false,
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const LISTA_META = {
  CEGOC:       { label: "CEGOC",       color: "#3b82f6", bg: "#1e3a5f" },
  PCDF_1HIGEIA:{ label: "PCDF 1ª",    color: "#a78bfa", bg: "#3b1f5f" },
  PCDF_2HIGEIA:{ label: "PCDF 2ª",    color: "#c084fc", bg: "#4a1f6f" },
  DPJ_GC99:   { label: "DPJ-GC99",   color: "#fb923c", bg: "#5f2a0e" },
};

const STATUS_META = {
  "EM DILIGÊNCIA": { color: "#22c55e",  bg: "rgba(34,197,94,0.12)"  },
  "AGUARDANDO":    { color: "#60a5fa",  bg: "rgba(96,165,250,0.12)" },
  "ATRASADO":      { color: "#f87171",  bg: "rgba(248,113,113,0.12)"},
  "PRAZO 6 MESES": { color: "#fbbf24",  bg: "rgba(251,191,36,0.12)" },
  "BAIXADO":       { color: "#6b7280",  bg: "rgba(107,114,128,0.12)"},
};

const TIPO_ICON = {
  CARRO:       "🚗",
  MOTO:        "🏍️",
  CAMINHONETE: "🛻",
  CAMINHÃO:    "🚛",
  REBOQUE:     "🚜",
};

const NAV_ITEMS = [
  { id: "inicio",    icon: IconHome,    label: "Início"      },
  { id: "fila",      icon: IconQueue,   label: "Minha Fila", active: true },
  { id: "cadastro",  icon: IconPlus,    label: "Cadastro"    },
  { id: "gestao",    icon: IconGrid,    label: "Gestão"      },
  { id: "busca",     icon: IconSearch,  label: "Busca Global"},
];

// ─── ICON COMPONENTS ──────────────────────────────────────────────────────────
function IconHome({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function IconQueue({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="17" width="11" height="4" rx="1"/>
    </svg>
  );
}
function IconPlus({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  );
}
function IconGrid({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  );
}
function IconSearch({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
    </svg>
  );
}
function IconBell({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  );
}
function IconFilter({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  );
}
function IconChevron({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}
function IconAlert({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
    </svg>
  );
}
function IconLogout({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

// ─── CARD COMPONENT ───────────────────────────────────────────────────────────
function BemCard({ item, onClick }) {
  const lista = LISTA_META[item.listaOrigem] || LISTA_META.CEGOC;
  const status = STATUS_META[item.STATUS_DILIGENCIA] || STATUS_META["AGUARDANDO"];
  const atrasado = item.diasSemAtualizacao > 30;
  const icon = TIPO_ICON[item.TIPO_BEM] || "📦";

  return (
    <div
      onClick={() => onClick(item)}
      style={{
        background: "linear-gradient(145deg, #0f2040 0%, #0a1628 100%)",
        border: `1px solid ${atrasado ? "rgba(248,113,113,0.35)" : "rgba(201,168,76,0.12)"}`,
        borderRadius: 12,
        padding: "18px 20px",
        cursor: "pointer",
        transition: "all 0.18s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = atrasado ? "rgba(248,113,113,0.6)" : "rgba(201,168,76,0.4)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = atrasado ? "rgba(248,113,113,0.35)" : "rgba(201,168,76,0.12)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Faixa lateral de origem */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
        background: lista.color, borderRadius: "12px 0 0 12px",
      }}/>

      {/* Header do card */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                fontWeight: 600,
                color: lista.color,
                background: lista.bg,
                padding: "2px 8px",
                borderRadius: 4,
                letterSpacing: "0.05em",
              }}>{lista.label}</span>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                color: "rgba(255,255,255,0.45)",
              }}>{item.id}</span>
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              color: "#c9a84c",
              marginTop: 4,
              letterSpacing: "0.03em",
            }}>{item.ID_PASEI}</div>
          </div>
        </div>

        {/* Badge de status */}
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: status.color,
          background: status.bg,
          padding: "4px 10px",
          borderRadius: 20,
          whiteSpace: "nowrap",
          border: `1px solid ${status.color}33`,
        }}>{item.STATUS_DILIGENCIA}</div>
      </div>

      {/* Corpo */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6px 16px",
        marginBottom: 12,
      }}>
        <Info label="Tipo" value={item.TIPO_BEM} />
        <Info label="Destinação" value={item.DESTINACAO} />
        {item.NIV && <Info label="NIV (Chassi)" value={item.NIV} mono />}
        {item.LOTE && <Info label="Lote" value={`#${item.LOTE}`} />}
        {item.RESTRICAO_ROUBO && <Info label="Restrição" value="🔒 Roubo/Furto" alert />}
        {item.FIB && <Info label="FIB" value="✓ Expedida" positive />}
      </div>

      {/* Observação */}
      <div style={{
        fontSize: 12,
        color: "rgba(255,255,255,0.45)",
        fontStyle: "italic",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        paddingTop: 10,
        lineHeight: 1.5,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>{item.OBSERVACOES}</div>

      {/* Footer */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 12,
        paddingTop: 10,
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        {atrasado ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            color: "#f87171", fontSize: 12, fontWeight: 600,
          }}>
            <IconAlert size={14} />
            {item.diasSemAtualizacao} dias sem atualização
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            Atualizado há {item.diasSemAtualizacao} dias
          </div>
        )}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          color: "#c9a84c", fontSize: 12, fontWeight: 500,
        }}>
          Ver detalhes <IconChevron size={14} />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono, alert, positive }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: 12,
        fontFamily: mono ? "'IBM Plex Mono', monospace" : "inherit",
        color: alert ? "#fbbf24" : positive ? "#22c55e" : "rgba(255,255,255,0.8)",
        fontWeight: 500,
      }}>{value}</div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function SIGNUMinhaFila() {
  const [activeNav, setActiveNav] = useState("fila");
  const [filterStatus, setFilterStatus] = useState("TODOS");
  const [filterLista, setFilterLista] = useState("TODAS");
  const [selectedItem, setSelectedItem] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const statusOptions = ["TODOS", "EM DILIGÊNCIA", "AGUARDANDO", "ATRASADO", "PRAZO 6 MESES"];
  const listaOptions = ["TODAS", "CEGOC", "PCDF_1HIGEIA", "PCDF_2HIGEIA", "DPJ_GC99"];

  const filtered = mockQueue.filter(item => {
    const matchStatus = filterStatus === "TODOS" || item.STATUS_DILIGENCIA === filterStatus;
    const matchLista = filterLista === "TODAS" || item.listaOrigem === filterLista;
    return matchStatus && matchLista;
  });

  const atrasadosCount = mockQueue.filter(i => i.diasSemAtualizacao > 30).length;

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: "#060f1e",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#e2e8f0",
      overflow: "hidden",
    }}>
      {/* ── SIDEBAR ── */}
      <Sidebar />

      {/* ── MAIN AREA ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: 60,
          background: "#0a1628",
          borderBottom: "1px solid rgba(201,168,76,0.1)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.4)",
                cursor: "pointer", padding: 4, display: "flex",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>SIGNU</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", margin: "0 6px" }}>/</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Minha Fila</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Alerta de itens atrasados */}
            {atrasadosCount > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 20,
                padding: "5px 12px",
                fontSize: 12,
                color: "#f87171",
                fontWeight: 600,
              }}>
                <IconAlert size={12} />
                {atrasadosCount} bem{atrasadosCount > 1 ? "ns" : ""} atrasado{atrasadosCount > 1 ? "s" : ""}
              </div>
            )}
            <button style={{
              background: "none", border: "none",
              color: "rgba(255,255,255,0.4)", cursor: "pointer",
              position: "relative", padding: 4,
            }}>
              <IconBell size={18} />
              <span style={{
                position: "absolute", top: 2, right: 2,
                width: 7, height: 7, borderRadius: "50%",
                background: "#c9a84c",
              }}/>
            </button>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "28px 28px 40px" }}>

          {/* Page header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.02em",
              margin: 0,
            }}>
              Minha Fila
            </h1>
            <p style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
              margin: "4px 0 0",
            }}>
              Bens atribuídos a <strong style={{ color: "rgba(201,168,76,0.8)" }}>{mockUser.displayName}</strong> — {mockQueue.length} itens em {Object.keys(LISTA_META).length} listas
            </p>
          </div>

          {/* Summary badges */}
          <div style={{
            display: "flex",
            gap: 10,
            marginBottom: 24,
            flexWrap: "wrap",
          }}>
            {Object.entries(LISTA_META).map(([key, meta]) => {
              const count = mockQueue.filter(i => i.listaOrigem === key).length;
              if (!count) return null;
              return (
                <div key={key} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: meta.bg,
                  border: `1px solid ${meta.color}44`,
                  borderRadius: 8,
                  padding: "8px 14px",
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: meta.color, flexShrink: 0,
                  }}/>
                  <span style={{ fontSize: 12, color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: "#fff",
                    background: "rgba(255,255,255,0.08)",
                    padding: "1px 7px", borderRadius: 12,
                  }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div style={{
            display: "flex",
            gap: 12,
            marginBottom: 24,
            flexWrap: "wrap",
            alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
              <IconFilter size={14} /> Filtrar:
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {statusOptions.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: filterStatus === s ? 600 : 400,
                    cursor: "pointer",
                    border: filterStatus === s
                      ? "1px solid #c9a84c"
                      : "1px solid rgba(255,255,255,0.1)",
                    background: filterStatus === s
                      ? "rgba(201,168,76,0.12)"
                      : "transparent",
                    color: filterStatus === s ? "#c9a84c" : "rgba(255,255,255,0.45)",
                    transition: "all 0.15s ease",
                  }}
                >{s}</button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }}/>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {listaOptions.map(l => {
                const meta = LISTA_META[l];
                return (
                  <button
                    key={l}
                    onClick={() => setFilterLista(l)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: filterLista === l ? 600 : 400,
                      cursor: "pointer",
                      border: filterLista === l
                        ? `1px solid ${meta?.color || "#c9a84c"}`
                        : "1px solid rgba(255,255,255,0.1)",
                      background: filterLista === l
                        ? `${meta?.bg || "rgba(201,168,76,0.12)"}`
                        : "transparent",
                      color: filterLista === l ? (meta?.color || "#c9a84c") : "rgba(255,255,255,0.45)",
                      transition: "all 0.15s ease",
                    }}
                  >{meta?.label || l}</button>
                );
              })}
            </div>
          </div>

          {/* Cards grid */}
          {filtered.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "rgba(255,255,255,0.25)",
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14 }}>Nenhum bem encontrado com estes filtros.</div>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: 16,
            }}>
              {filtered.map(item => (
                <BemCard key={item.id} item={item} onClick={setSelectedItem} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── DETAIL DRAWER ── */}
      {selectedItem && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex",
        }}>
          <div
            onClick={() => setSelectedItem(null)}
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
            }}
          />
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0,
            width: 440,
            background: "#0a1628",
            borderLeft: "1px solid rgba(201,168,76,0.2)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Drawer header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(201,168,76,0.7)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                  {LISTA_META[selectedItem.listaOrigem]?.label} · {selectedItem.id}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                  {TIPO_ICON[selectedItem.TIPO_BEM]} {selectedItem.TIPO_BEM}
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{
                  background: "rgba(255,255,255,0.06)", border: "none",
                  borderRadius: 8, width: 32, height: 32,
                  color: "rgba(255,255,255,0.5)", cursor: "pointer",
                  fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >×</button>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                {[
                  ["ID_PASEI", selectedItem.ID_PASEI, true],
                  ["Status", selectedItem.STATUS_DILIGENCIA],
                  ["Tipo de Bem", selectedItem.TIPO_BEM],
                  ["Destinação", selectedItem.DESTINACAO],
                  selectedItem.NIV && ["NIV / Chassi", selectedItem.NIV, true],
                  selectedItem.LOTE && ["Lote DPJ", `#${selectedItem.LOTE}`],
                ].filter(Boolean).map(([label, val, mono]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 13, fontFamily: mono ? "'IBM Plex Mono', monospace" : "inherit", color: "#fff", fontWeight: 500 }}>{val}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Observações</div>
                <div style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.6,
                }}>{selectedItem.OBSERVACOES}</div>
              </div>

              {/* Transição buttons (CEGOC only) */}
              {selectedItem.listaOrigem === "CEGOC" && (
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Ações de Transição</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedItem.DESTINACAO === "EM DILIGÊNCIA HIGEIA" && (
                      <button style={{
                        padding: "12px 16px",
                        background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))",
                        border: "1px solid rgba(59,130,246,0.4)",
                        borderRadius: 10,
                        color: "#60a5fa",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left",
                      }}>
                        🏛️ Mover → PCDF 2ª HIGEIA
                        <div style={{ fontSize: 11, fontWeight: 400, color: "rgba(96,165,250,0.6)", marginTop: 2 }}>
                          POST /api/bens/{selectedItem.id}/transicao
                        </div>
                      </button>
                    )}
                    {selectedItem.DESTINACAO === "LPC" && (
                      <button style={{
                        padding: "12px 16px",
                        background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))",
                        border: "1px solid rgba(34,197,94,0.4)",
                        borderRadius: 10,
                        color: "#22c55e",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left",
                      }}>
                        📋 LPC → CATÁLOGO
                        <div style={{ fontSize: 11, fontWeight: 400, color: "rgba(34,197,94,0.6)", marginTop: 2 }}>
                          POST /api/bens/{selectedItem.id}/transicao
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer footer */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              gap: 10,
            }}>
              <button style={{
                flex: 1, padding: "10px",
                background: "rgba(201,168,76,0.1)",
                border: "1px solid rgba(201,168,76,0.3)",
                borderRadius: 8, color: "#c9a84c",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>✏️ Editar Campos</button>
              <button style={{
                flex: 1, padding: "10px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, color: "rgba(255,255,255,0.5)",
                fontSize: 13, cursor: "pointer",
              }}>📎 Anexos</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
