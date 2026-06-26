"use client";
import Sidebar from "@/components/Sidebar";
import { useSession } from "next-auth/react";

import { useState, useEffect, useCallback } from "react";

// Lista de servidores (exibida no seletor manual de fallback)
const SERVIDORES = [
  "Carla Araújo","Amanda Junqueira","Carlos Caetano",
  "Cláudia Santos","Loara Passo","Letícia Mota","Marcelo Oliveira",
];

// Listas que alimentam a fila de trabalho
const LISTAS_FILA = [
  { key:"CEGOC",        rota:"cegoc",  prefixo:"CEG",   statusField:"STATUS_DILIGENCIA" },
  { key:"PCDF_1HIGEIA", rota:"pcdf1",  prefixo:"PCDF1", statusField:"STATUS_DILIGENCIA" },
  { key:"PCDF_2HIGEIA", rota:"pcdf2",  prefixo:"PCDF2", statusField:"STATUS_DILIGENCIA" },
  { key:"DPJ_GC99",     rota:"dpj",    prefixo:"DPJ",   statusField:"STATUS_DILIGENCIA" },
];

// Placeholder para manter compatibilidade com o card (removido abaixo)
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
  // Filtros multi-seleção — conjunto vazio = "todos"
  const [filtroStatus, setFiltroStatus] = useState(new Set());
  const [filtroLista,  setFiltroLista]  = useState(new Set());
  const [filtroTipo,   setFiltroTipo]   = useState(new Set());
  const [busca,        setBusca]        = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const toggleSet = (setter, val) =>
    setter(prev => {
      const next = new Set(prev);
      next.has(val) ? next.delete(val) : next.add(val);
      return next;
    });

  const limparFiltros = () => {
    setFiltroStatus(new Set());
    setFiltroLista(new Set());
    setFiltroTipo(new Set());
    setBusca("");
  };

  const totalFiltrosAtivos =
    filtroStatus.size + filtroLista.size + filtroTipo.size + (busca.trim() ? 1 : 0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: session } = useSession();

  // Dados reais
  const [fila, setFila] = useState([]);
  const [carregando, setCarregando] = useState(false);
  // Usa o nome da sessão Google; fallback para o primeiro da lista
  const [usuarioAtual, setUsuarioAtual] = useState(SERVIDORES[0]);

  // Quando a sessão carregar, define o usuário atual
  useEffect(() => {
    if (session?.user?.name) {
      setUsuarioAtual(session.user.name);
    }
  }, [session]);

  const statusOptions = ["EM DILIGÊNCIA", "AGUARDANDO", "ATRASADO", "PRAZO 6 MESES", "BAIXADO"];
  const listaOptions  = ["CEGOC", "PCDF_1HIGEIA", "PCDF_2HIGEIA", "DPJ_GC99"];

  // Carrega itens de todas as listas atribuídos ao usuário
  const carregarFila = useCallback(async (usuario) => {
    setCarregando(true);
    setFila([]);
    const resultados = await Promise.allSettled(
      LISTAS_FILA.map(async (cfg) => {
        const res = await fetch(`/api/bens/${cfg.rota}?atribuidoA=${encodeURIComponent(usuario)}`);
        const json = await res.json();
        return (json.dados || []).map(r => ({
          ...r,
          id: r.ID_LEGADO || `${cfg.prefixo}-${String(r._rowNumber).padStart(4,"0")}`,
          listaOrigem: cfg.key,
          STATUS_DILIGENCIA: r[cfg.statusField] || r.STATUS_DILIGENCIA || "",
          diasSemAtualizacao: 0, // campo calculado — não disponível na planilha ainda
        }));
      })
    );
    const todos = resultados.flatMap(r => r.status === "fulfilled" ? r.value : []);
    setFila(todos);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregarFila(usuarioAtual);
  }, [usuarioAtual, carregarFila]);

  const filtered = fila.filter(item => {
    if (filtroStatus.size > 0 && !filtroStatus.has(item.STATUS_DILIGENCIA)) return false;
    if (filtroLista.size  > 0 && !filtroLista.has(item.listaOrigem))        return false;
    if (filtroTipo.size   > 0 && !filtroTipo.has(item.TIPO_BEM))            return false;
    if (busca.trim()) {
      const q = busca.trim().toUpperCase();
      const campos = [item.id, item.ID_PASEI, item.NIV, item.TIPO_BEM, item.STATUS_DILIGENCIA, item.DESTINACAO, item.OBSERVACOES].join(" ").toUpperCase();
      if (!campos.includes(q)) return false;
    }
    return true;
  });

  const atrasadosCount = fila.filter(i => i.STATUS_DILIGENCIA === "ATRASADO").length;

  return (
    <div className="signu-layout" style={{ background: "#060f1e", fontFamily: "'Inter', system-ui, sans-serif", color: "#e2e8f0" }}>
      {/* ── SIDEBAR ── */}
      <Sidebar />

      {/* ── MAIN AREA ── */}
      <main className="signu-main">

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

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Usuário logado via Google — exibe avatar + nome; seletor manual como fallback */}
            {session?.user ? (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:8, padding:"4px 10px" }}>
                {session.user.image && (
                  <img src={session.user.image} alt="" style={{ width:22, height:22, borderRadius:"50%", border:"1px solid rgba(201,168,76,0.3)" }}/>
                )}
                <span style={{ fontSize:12, fontWeight:600, color:"#c9a84c" }}>{session.user.name}</span>
              </div>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:8, padding:"4px 10px" }}>
                <span style={{ fontSize:10, color:"rgba(201,168,76,0.6)", fontWeight:700, textTransform:"uppercase" }}>Servidor:</span>
                <select value={usuarioAtual} onChange={e => setUsuarioAtual(e.target.value)}
                  style={{ background:"transparent", border:"none", color:"#c9a84c", fontSize:12, fontWeight:600, cursor:"pointer", outline:"none" }}>
                  {SERVIDORES.map(s => <option key={s} value={s} style={{ background:"#0a1628" }}>{s}</option>)}
                </select>
              </div>
            )}
            {/* Alerta de itens atrasados */}
            {atrasadosCount > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 20, padding: "5px 12px",
                fontSize: 12, color: "#f87171", fontWeight: 600,
              }}>
                <IconAlert size={12} />
                {atrasadosCount} atrasado{atrasadosCount > 1 ? "s" : ""}
              </div>
            )}
            {carregando && (
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>carregando…</span>
            )}
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
              Bens atribuídos a <strong style={{ color: "rgba(201,168,76,0.8)" }}>{usuarioAtual}</strong> — {fila.length} itens em {LISTAS_FILA.length} listas
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
              const count = fila.filter(i => i.listaOrigem === key).length;
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

          {/* ── Painel de filtros ── */}
          <div style={{ marginBottom:24 }}>
            {/* Barra de controle */}
            <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom: filtrosAbertos ? 12 : 0 }}>
              {/* Busca por texto */}
              <div style={{ position:"relative", flex:1, minWidth:180 }}>
                <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", opacity:.4 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar por ID, NIV, tipo…"
                  style={{ width:"100%", padding:"7px 10px 7px 30px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#fff", fontSize:12, outline:"none", boxSizing:"border-box" }}
                />
              </div>

              {/* Botão expandir filtros */}
              <button
                onClick={() => setFiltrosAbertos(o => !o)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", background: filtrosAbertos || totalFiltrosAtivos > 0 ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.04)", border:`1px solid ${filtrosAbertos || totalFiltrosAtivos > 0 ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius:8, color: filtrosAbertos || totalFiltrosAtivos > 0 ? "#c9a84c" : "rgba(255,255,255,0.5)", fontSize:12, fontWeight:600, cursor:"pointer" }}
              >
                <IconFilter size={13}/>
                Filtros
                {totalFiltrosAtivos > 0 && (
                  <span style={{ background:"#c9a84c", color:"#0a1628", borderRadius:10, padding:"0 6px", fontSize:10, fontWeight:800, marginLeft:2 }}>{totalFiltrosAtivos}</span>
                )}
              </button>

              {/* Resultado + limpar */}
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>
                {filtered.length} de {fila.length} item{fila.length !== 1 ? "s" : ""}
              </span>
              {totalFiltrosAtivos > 0 && (
                <button onClick={limparFiltros} style={{ fontSize:11, color:"rgba(255,255,255,0.4)", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
                  Limpar filtros
                </button>
              )}
            </div>

            {/* Painel expansível */}
            {filtrosAbertos && (
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:"16px 18px", display:"flex", flexDirection:"column", gap:14 }}>

                {/* Status */}
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Status</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {statusOptions.map(s => {
                      const ativo = filtroStatus.has(s);
                      const cor = s === "ATRASADO" ? "#f87171" : s === "PRAZO 6 MESES" ? "#fbbf24" : s === "EM DILIGÊNCIA" ? "#22c55e" : s === "AGUARDANDO" ? "#60a5fa" : "rgba(255,255,255,0.5)";
                      return (
                        <button key={s} onClick={() => toggleSet(setFiltroStatus, s)}
                          style={{ padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight: ativo ? 700 : 400, cursor:"pointer", border:`1px solid ${ativo ? cor : "rgba(255,255,255,0.1)"}`, background: ativo ? `${cor}18` : "transparent", color: ativo ? cor : "rgba(255,255,255,0.45)", transition:"all 0.15s" }}>
                          {ativo && "✓ "}{s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lista */}
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Lista</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {listaOptions.map(l => {
                      const meta = LISTA_META[l];
                      const ativo = filtroLista.has(l);
                      return (
                        <button key={l} onClick={() => toggleSet(setFiltroLista, l)}
                          style={{ padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight: ativo ? 700 : 400, cursor:"pointer", border:`1px solid ${ativo ? meta?.color : "rgba(255,255,255,0.1)"}`, background: ativo ? meta?.bg : "transparent", color: ativo ? meta?.color : "rgba(255,255,255,0.45)", transition:"all 0.15s" }}>
                          {ativo && "✓ "}{meta?.label || l}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tipo de Bem */}
                {fila.length > 0 && (() => {
                  const tipos = [...new Set(fila.map(i => i.TIPO_BEM).filter(Boolean))].sort();
                  if (!tipos.length) return null;
                  const icones = { CARRO:"🚗", MOTO:"🏍️", CAMINHONETE:"🛻", CAMINHÃO:"🚛", REBOQUE:"🚜", OUTROS:"📦" };
                  return (
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Tipo de Bem</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {tipos.map(t => {
                          const ativo = filtroTipo.has(t);
                          const count = fila.filter(i => i.TIPO_BEM === t).length;
                          return (
                            <button key={t} onClick={() => toggleSet(setFiltroTipo, t)}
                              style={{ padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight: ativo ? 700 : 400, cursor:"pointer", border:`1px solid ${ativo ? "#c9a84c" : "rgba(255,255,255,0.1)"}`, background: ativo ? "rgba(201,168,76,0.12)" : "transparent", color: ativo ? "#c9a84c" : "rgba(255,255,255,0.45)", transition:"all 0.15s", display:"flex", alignItems:"center", gap:5 }}>
                              <span>{icones[t] || "📦"}</span>
                              {ativo && "✓ "}{t}
                              <span style={{ fontSize:10, opacity:.6 }}>({count})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Chips de filtros ativos (sempre visíveis fora do painel) */}
            {!filtrosAbertos && totalFiltrosAtivos > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
                {[...filtroStatus].map(s => (
                  <span key={s} onClick={() => toggleSet(setFiltroStatus, s)}
                    style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 10px", background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.3)", borderRadius:20, fontSize:11, color:"#c9a84c", cursor:"pointer" }}>
                    {s} ✕
                  </span>
                ))}
                {[...filtroLista].map(l => {
                  const meta = LISTA_META[l];
                  return (
                    <span key={l} onClick={() => toggleSet(setFiltroLista, l)}
                      style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 10px", background: meta?.bg || "rgba(255,255,255,0.05)", border:`1px solid ${meta?.color || "rgba(255,255,255,0.2)"}`, borderRadius:20, fontSize:11, color: meta?.color || "#fff", cursor:"pointer" }}>
                      {meta?.label || l} ✕
                    </span>
                  );
                })}
                {[...filtroTipo].map(t => (
                  <span key={t} onClick={() => toggleSet(setFiltroTipo, t)}
                    style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 10px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, fontSize:11, color:"rgba(255,255,255,0.6)", cursor:"pointer" }}>
                    {t} ✕
                  </span>
                ))}
              </div>
            )}
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
