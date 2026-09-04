"use client";
import Sidebar from "@/components/Sidebar";
import { useSession } from "next-auth/react";

import { useState, useEffect, useCallback } from "react";
import { parseNotas, ultimaObs } from "@/lib/observacoes";

// Lista de servidores (exibida no seletor manual de fallback)
const SERVIDORES = [
  "Carla Araújo","Amanda Junqueira","Carlos Caetano",
  "Cláudia Santos","Loara Passo","Letícia Mota","Marcelo Oliveira",
];

// Mapeamento Gmail pessoal → nome exato no sistema (campo RESPONSAVEL)
// Adicione aqui o e-mail pessoal de cada servidor ao onboarding
const MAPA_EMAIL_NOME = {
  "danieldeandrade@icloud.com":        null,   // gestor — usa select
  "carlosalex1318@gmail.com":          null,   // gestor — usa select
  // Servidores com Gmail pessoal de teste:
  "carcae@gmail.com":                  "Carlos Caetano",
  "amandalobojunqueira@gmail.com":     "Amanda Junqueira",
  "bsboqfazer@gmail.com":              "Letícia Mota",
  "carlaearaujo2@gmail.com":           "Carla Araújo",
  "marcelodefreitasoliveira@gmail.com":"Marcelo Oliveira",
  "joloara@gmail.com":                 "Loara Passo",
  "cacausantos@gmail.com":             "Cláudia Santos",
};

const GESTORES_GMAIL = ["danieldeandrade.pessoal@gmail.com","danieldeandrade@icloud.com","carlosalex1318@gmail.com"];

// Resolve qual nome do sistema corresponde ao usuário logado.
// Prioridade: 1) mapa de e-mail  2) nome Google bate exatamente com SERVIDORES
function resolverNomeServidor(email, nomeGoogle) {
  if (!email && !nomeGoogle) return null;
  // 1. Mapa explícito de e-mail
  if (email && MAPA_EMAIL_NOME[email] !== undefined) return MAPA_EMAIL_NOME[email]; // null = gestor
  // 2. Nome Google bate exatamente (caso o display name já seja o nome do sistema)
  const match = SERVIDORES.find(s => s.toLowerCase() === (nomeGoogle || "").toLowerCase());
  if (match) return match;
  // 3. Não identificado — retorna null para mostrar seletor
  return null;
}

// Listas que alimentam a fila de trabalho
const LISTAS_FILA = [
  { key:"CEGOC",        rota:"cegoc",  prefixo:"CEG",   statusField:"STATUS_DILIGENCIA" },
  { key:"PCDF_1HIGEIA", rota:"pcdf1",  prefixo:"PCDF1", statusField:"STATUS_DILIGENCIA" },
  { key:"PCDF_2HIGEIA", rota:"pcdf2",  prefixo:"PCDF2", statusField:"STATUS_DILIGENCIA" },
  { key:"DPJ_GC99",     rota:"dpj",    prefixo:"DPJ",   statusField:"STATUS_DILIGENCIA" },
  { key:"CAIXA_SEI",    rota:"sei",    prefixo:"CAIXA", statusField:"ACAO" },
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
  DPJ_GC99:    { label: "DPJ-GC99",   color: "#fb923c", bg: "#5f2a0e" },
  CAIXA_SEI:   { label: "Caixa SEI",  color: "#fbbf24", bg: "#451a03" },
};

const STATUS_META = {
  "EM DILIGÊNCIA":   { color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  "AGUARDANDO":      { color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  "ATRASADO":        { color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  "PRAZO 6 MESES":   { color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  "BAIXADO":         { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  // Ações SEI
  "DILIGÊNCIA":      { color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  "ARQUIVADO":       { color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  "ENCAMINHAR":      { color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  "AGUARDAR RETORNO":{ color: "#f97316", bg: "rgba(249,115,22,0.12)"  },
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

// ─── RENAJUD helpers ──────────────────────────────────────────────────────────
function parseRenajuds(str) {
  try { return JSON.parse(str || "[]"); } catch { return []; }
}
function renajudInfo(item) {
  const lista = parseRenajuds(item?.RENAJUDS);
  if (!lista.length) return null;
  const pendentes = lista.filter(r => !r.baixado).length;
  const baixadas  = lista.filter(r =>  r.baixado).length;
  return { total: lista.length, pendentes, baixadas };
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
        background: "#fff",
        border: `1px solid ${atrasado ? "rgba(248,113,113,0.35)" : "rgba(37,99,235,0.1)"}`,
        borderRadius: 12,
        padding: "18px 20px",
        cursor: "pointer",
        transition: "all 0.18s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = atrasado ? "rgba(248,113,113,0.6)" : "rgba(37,99,235,0.4)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = atrasado ? "rgba(248,113,113,0.35)" : "rgba(37,99,235,0.1)";
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
                color: "#374151",
              }}>{item.id}</span>
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              color: "#2563eb",
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

      {/* Badge RENAJUD */}
      {(() => {
        const r = renajudInfo(item);
        if (!r) return null;
        return (
          <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
            {r.pendentes > 0 && (
              <span style={{ fontSize:11, fontWeight:700, color:"#f87171", background:"rgba(248,113,113,0.1)", padding:"2px 9px", borderRadius:20, border:"1px solid rgba(248,113,113,0.35)" }}>
                🔒 {r.pendentes} pendente{r.pendentes !== 1 ? "s" : ""}
              </span>
            )}
            {r.baixadas > 0 && (
              <span style={{ fontSize:11, fontWeight:700, color:"#22c55e", background:"rgba(34,197,94,0.1)", padding:"2px 9px", borderRadius:20, border:"1px solid rgba(34,197,94,0.35)" }}>
                ✓ {r.baixadas} baixada{r.baixadas !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        );
      })()}

      {/* Observação */}
      <div style={{
        fontSize: 12,
        color: "#374151",
        fontStyle: "italic",
        borderTop: "1px solid #e5e7eb",
        paddingTop: 10,
        lineHeight: 1.5,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>{ultimaObs(item.OBSERVACOES)}</div>

      {/* Footer */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 12,
        paddingTop: 10,
        borderTop: "1px solid #e5e7eb",
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
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Atualizado há {item.diasSemAtualizacao} dias
          </div>
        )}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          color: "#2563eb", fontSize: 12, fontWeight: 500,
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
      <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: 12,
        fontFamily: mono ? "'IBM Plex Mono', monospace" : "inherit",
        color: alert ? "#fbbf24" : positive ? "#22c55e" : "#0f172a",
        fontWeight: 500,
      }}>{value}</div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function SIGNUMinhaFila() {
  const [activeNav, setActiveNav] = useState("fila");
  // Filtros multi-seleção — conjunto vazio = "todos"
  const [filtroStatus,    setFiltroStatus]    = useState(new Set());
  const [filtroLista,     setFiltroLista]     = useState(new Set());
  const [filtroTipo,      setFiltroTipo]      = useState(new Set());
  const [filtroFlags,     setFiltroFlags]     = useState(new Set()); // FIB | CEB_TEP_TIV | OFICIO_BAIXA | HIGEIA
  const [filtroDestinacao,setFiltroDestinacao]= useState(new Set());
  const [busca,        setBusca]        = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [sortOrder, setSortOrder] = useState("recentes"); // "recentes" | "antigos"

  // Cabeçalho de ordenação da tabela
  const [sortCol,  setSortCol]  = useState("ULTIMA_ANALISE");
  const [sortDir,  setSortDir]  = useState("desc"); // desc = mais recentes primeiro

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

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
    setFiltroFlags(new Set());
    setFiltroDestinacao(new Set());
    setBusca("");
  };

  const flagAtiva = (item, flag) => {
    if (flag === "FIB")         return item.FIB === "TRUE" || item.FIB === true;
    if (flag === "CEB_TEP_TIV") return item.CEB_TEP_TIV === "TRUE" || item.CEB_TEP_TIV === true;
    if (flag === "OFICIO_BAIXA")return item.OFICIO_BAIXA === "TRUE" || item.OFICIO_BAIXA === true;
    if (flag === "HIGEIA")      return item.STATUS_DILIGENCIA === "EM DILIGÊNCIA HIGEIA";
    return false;
  };

  const totalFiltrosAtivos =
    filtroStatus.size + filtroLista.size + filtroTipo.size + filtroFlags.size + filtroDestinacao.size + (busca.trim() ? 1 : 0);
  const [selectedItem,   setSelectedItem]   = useState(null);
  const [drawerEditMode, setDrawerEditMode] = useState(false);
  const [drawerEditData, setDrawerEditData] = useState(null);
  const [drawerSalvando, setDrawerSalvando] = useState(false);
  const [drawerToast,    setDrawerToast]    = useState(null);

  const ROTA_MAP = { CEGOC:"cegoc", PCDF_1HIGEIA:"pcdf1", PCDF_2HIGEIA:"pcdf2", DPJ_GC99:"dpj", CAIXA_SEI:"sei" };
  const DESTINACOES_OPT = ["CIRCULAÇÃO","RECICLAGEM"];

  const abrirDrawer = (item) => {
    setSelectedItem(item);
    setDrawerEditMode(false);
    setDrawerEditData(null);
    setDrawerToast(null);
  };

  const iniciarEdicao = () => {
    setDrawerEditData({ ...selectedItem });
    setDrawerEditMode(true);
  };

  const cancelarEdicao = () => {
    setDrawerEditMode(false);
    setDrawerEditData(null);
  };

  const concluirSEI = async (item, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/bens/sei/${item._rowNumber}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ACAO:"ARQUIVADO"}),
      });
      if (!res.ok) throw new Error("Erro ao arquivar processo SEI");
      setFila(prev => prev.map(i =>
        i._rowNumber === item._rowNumber && i.listaOrigem === "CAIXA_SEI"
          ? { ...i, STATUS_DILIGENCIA: "ARQUIVADO" }
          : i
      ));
    } catch(err) {
      alert(err.message);
    }
  };

  const updDrawer = (field, val) => setDrawerEditData(prev => ({ ...prev, [field]: val }));

  const boolStr = (v) => (v === true || v === "TRUE") ? "TRUE" : "FALSE";

  const salvarDrawer = async () => {
    if (!drawerEditData) return;
    setDrawerSalvando(true);
    try {
      const rota = ROTA_MAP[selectedItem.listaOrigem];
      const row  = selectedItem._rowNumber;
      const payload = { ...drawerEditData };
      // Não sobrescrever OBSERVACOES — gerenciado separadamente
      delete payload.OBSERVACOES;
      // Serializa booleanos
      ["FIB","CEB_TEP_TIV","OFICIO_BAIXA","RESTRICAO_ROUBO"].forEach(k => {
        if (k in payload) payload[k] = boolStr(payload[k]);
      });
      const res  = await fetch(`/api/bens/${rota}/${row}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Erro ao salvar");
      // Atualiza o item na tabela sem recarregar tudo
      const atualizado = { ...json.item, id: selectedItem.id, listaOrigem: selectedItem.listaOrigem, STATUS_DILIGENCIA: json.item.STATUS_DILIGENCIA || json.item[LISTAS_FILA.find(l=>l.key===selectedItem.listaOrigem)?.statusField] || selectedItem.STATUS_DILIGENCIA };
      setFila(prev => prev.map(i => i._rowNumber === row && i.listaOrigem === selectedItem.listaOrigem ? { ...atualizado } : i));
      setSelectedItem(atualizado);
      setDrawerEditMode(false);
      setDrawerEditData(null);
      setDrawerToast({ tipo:"ok", msg:"Salvo com sucesso!" });
      setTimeout(() => setDrawerToast(null), 3000);
    } catch(e) {
      setDrawerToast({ tipo:"erro", msg: e.message });
    } finally {
      setDrawerSalvando(false);
    }
  };
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: session } = useSession();

  // Dados reais
  const [fila, setFila] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState(null); // null = ainda resolvendo
  const [isGestor, setIsGestor] = useState(false);

  // Resolve identidade quando a sessão carregar
  useEffect(() => {
    if (!session?.user) return;
    const email      = session.user.email || "";
    const nomeGoogle = session.user.name  || "";
    const gestor     = GESTORES_GMAIL.includes(email);
    setIsGestor(gestor);
    if (gestor) {
      // Gestor vê o seletor — inicia no primeiro servidor
      setUsuarioAtual(prev => prev || SERVIDORES[0]);
    } else {
      const nome = resolverNomeServidor(email, nomeGoogle);
      setUsuarioAtual(nome || SERVIDORES[0]); // fallback: primeiro da lista
    }
  }, [session]);

  const statusOptions = ["EM DILIGÊNCIA", "EM DILIGÊNCIA HIGEIA", "AGUARDANDO", "ATRASADO", "PRAZO 6 MESES", "RENAJUD", "LPC", "CATÁLOGO", "BAIXADO"];
  const listaOptions  = ["CEGOC", "PCDF_1HIGEIA", "PCDF_2HIGEIA", "DPJ_GC99", "CAIXA_SEI"];

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
    if (item.listaOrigem === "CAIXA_SEI" && item.STATUS_DILIGENCIA === "ARQUIVADO") return false;
    if (filtroStatus.size     > 0 && !filtroStatus.has(item.STATUS_DILIGENCIA))                       return false;
    if (filtroLista.size      > 0 && !filtroLista.has(item.listaOrigem))                              return false;
    if (filtroTipo.size       > 0 && !filtroTipo.has(item.TIPO_BEM))                                  return false;
    if (filtroFlags.size      > 0 && ![...filtroFlags].some(f => flagAtiva(item, f)))                 return false;
    if (filtroDestinacao.size > 0 && !filtroDestinacao.has(item.DESTINACAO))                          return false;
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      const campos = [item.id, ...Object.values(item).filter(v => typeof v === "string")].join(" ").toLowerCase();
      if (!campos.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortCol === "ULTIMA_ANALISE") {
      const da = a.ULTIMA_ANALISE ? new Date(a.ULTIMA_ANALISE).getTime() : 0;
      const db = b.ULTIMA_ANALISE ? new Date(b.ULTIMA_ANALISE).getTime() : 0;
      return (da - db) * mul;
    }
    if (sortCol === "TIPO_BEM")         return (a.TIPO_BEM||"").localeCompare(b.TIPO_BEM||"") * mul;
    if (sortCol === "STATUS_DILIGENCIA")return (a.STATUS_DILIGENCIA||"").localeCompare(b.STATUS_DILIGENCIA||"") * mul;
    if (sortCol === "listaOrigem")      return (a.listaOrigem||"").localeCompare(b.listaOrigem||"") * mul;
    return 0;
  });

  const atrasadosCount = fila.filter(i => i.STATUS_DILIGENCIA === "ATRASADO").length;

  return (
    <div className="signu-layout" style={{ background: "#dde1e7", fontFamily: "'Inter', system-ui, sans-serif", color: "#111827" }}>
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
          background: "#1e2d3d",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{
                background: "none", border: "none", color: "#4b5563",
                cursor: "pointer", padding: 4, display: "flex",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <span style={{ fontSize: 13, color: "#6b7280" }}>SIGNU</span>
              <span style={{ fontSize: 13, color: "#9ca3af", margin: "0 6px" }}>/</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Minha Fila</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Gestores veem seletor; servidores veem apenas o próprio nome */}
            {isGestor ? (
              <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(37,99,235,0.07)", border:"1.5px solid #b0b8c4", borderRadius:8, padding:"4px 10px" }}>
                <span style={{ fontSize:10, color:"#2563eb", fontWeight:700, textTransform:"uppercase" }}>Ver fila de:</span>
                <select value={usuarioAtual || ""} onChange={e => setUsuarioAtual(e.target.value)}
                  style={{ background:"transparent", border:"none", color:"#2563eb", fontSize:12, fontWeight:600, cursor:"pointer", outline:"none" }}>
                  {SERVIDORES.map(s => <option key={s} value={s} style={{ background:"#fff", color:"#111827" }}>{s}</option>)}
                </select>
              </div>
            ) : session?.user ? (
              /* Servidor: nome resolvido + foto, sem seletor */
              <div style={{ display:"flex", alignItems:"center", gap:7, background:"#f3f4f6", border:"1.5px solid #b0b8c4", borderRadius:8, padding:"4px 10px" }}>
                {session.user.image && (
                  <img src={session.user.image} alt="" style={{ width:20, height:20, borderRadius:"50%", border:"1.5px solid #b0b8c4" }}/>
                )}
                <span style={{ fontSize:12, fontWeight:600, color:"#2563eb" }}>{usuarioAtual || session.user.name}</span>
              </div>
            ) : null}
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
              <span style={{ fontSize:11, color:"#6b7280" }}>carregando…</span>
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
              color: "#0f172a",
              letterSpacing: "-0.02em",
              margin: 0,
            }}>
              Minha Fila
            </h1>
            <p style={{
              fontSize: 13,
              color: "#4b5563",
              margin: "4px 0 0",
            }}>
              Bens atribuídos a <strong style={{ color: "#1e40af" }}>{usuarioAtual}</strong> — {fila.length} itens em {LISTAS_FILA.length} listas
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
                    background: "#e5e7eb",
                    padding: "1px 7px", borderRadius: 12,
                  }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* ── Painel de filtros ── */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom: filtrosAbertos ? 10 : 0 }}>
              <div style={{ position:"relative", flex:1, minWidth:180 }}>
                <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", opacity:.4 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por ID, NIV, tipo…"
                  style={{ width:"100%", padding:"7px 10px 7px 30px", background:"#f3f4f6", border:"1.5px solid #c4c9d0", borderRadius:8, color:"#0f172a", fontSize:12, outline:"none", boxSizing:"border-box" }}/>
              </div>
              <button onClick={() => setFiltrosAbertos(o => !o)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", background: filtrosAbertos||totalFiltrosAtivos>0?"rgba(37,99,235,0.1)":"#f3f4f6", border:`1px solid ${filtrosAbertos||totalFiltrosAtivos>0?"rgba(37,99,235,0.4)":"#d1d5db"}`, borderRadius:8, color:filtrosAbertos||totalFiltrosAtivos>0?"#2563eb":"#374151", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                <IconFilter size={13}/> Filtros
                {totalFiltrosAtivos > 0 && <span style={{ background:"#2563eb", color:"#fff", borderRadius:10, padding:"0 6px", fontSize:10, fontWeight:800 }}>{totalFiltrosAtivos}</span>}
              </button>
              {/* Ordenação */}
              <button onClick={() => { setSortCol("ULTIMA_ANALISE"); setSortDir(d => d==="desc"?"asc":"desc"); }}
                style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 12px", background:"#f3f4f6", border:"1.5px solid #c4c9d0", borderRadius:8, color:"#374151", fontSize:12, cursor:"pointer" }}>
                {sortDir==="desc"?"↓":"↑"} {sortDir==="desc"?"Mais recentes":"Mais antigos"}
              </button>
              <span style={{ fontSize:11, color:"#6b7280" }}>{sorted.length} de {fila.length}</span>
              {totalFiltrosAtivos > 0 && <button onClick={limparFiltros} style={{ fontSize:11, color:"#4b5563", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>Limpar</button>}
            </div>

            {filtrosAbertos && (
              <div style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:12 }}>
                {/* Status */}
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:7 }}>Status</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {statusOptions.map(s => {
                      const ativo = filtroStatus.has(s);
                      const cor = s==="ATRASADO"?"#f87171":s==="PRAZO 6 MESES"?"#fbbf24":s==="EM DILIGÊNCIA"?"#22c55e":s==="AGUARDANDO"?"#60a5fa":s==="RENAJUD"?"#f472b6":s==="EM DILIGÊNCIA HIGEIA"?"#a78bfa":"#374151";
                      return <button key={s} onClick={() => toggleSet(setFiltroStatus,s)}
                        style={{ padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:ativo?700:400, cursor:"pointer", border:`1px solid ${ativo?cor:"#d1d5db"}`, background:ativo?`${cor}18`:"transparent", color:ativo?cor:"#374151" }}>
                        {ativo&&"✓ "}{s}
                      </button>;
                    })}
                  </div>
                </div>
                {/* Lista */}
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:7 }}>Lista</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {listaOptions.map(l => {
                      const meta = LISTA_META[l]; const ativo = filtroLista.has(l);
                      return <button key={l} onClick={() => toggleSet(setFiltroLista,l)}
                        style={{ padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:ativo?700:400, cursor:"pointer", border:`1px solid ${ativo?meta?.color:"#d1d5db"}`, background:ativo?meta?.bg:"transparent", color:ativo?meta?.color:"#374151" }}>
                        {ativo&&"✓ "}{meta?.label||l}
                      </button>;
                    })}
                  </div>
                </div>
                {/* Tipo */}
                {(() => {
                  const tipos = [...new Set(fila.map(i=>i.TIPO_BEM).filter(Boolean))].sort();
                  const icones = {CARRO:"🚗",MOTO:"🏍️",CAMINHONETE:"🛻",CAMINHÃO:"🚛",REBOQUE:"🚜",OUTROS:"📦"};
                  if (!tipos.length) return null;
                  return <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:7 }}>Tipo</div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {tipos.map(t => { const ativo=filtroTipo.has(t); return <button key={t} onClick={() => toggleSet(setFiltroTipo,t)}
                        style={{ padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:ativo?700:400, cursor:"pointer", border:`1px solid ${ativo?"#2563eb":"#d1d5db"}`, background:ativo?"rgba(37,99,235,0.1)":"transparent", color:ativo?"#2563eb":"#374151" }}>
                        {icones[t]||"📦"} {ativo&&"✓ "}{t}
                      </button>; })}
                    </div>
                  </div>;
                })()}
                {/* Destinação */}
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:7 }}>Destinação</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {["CIRCULAÇÃO","RECICLAGEM"].map(d => {
                      const ativo = filtroDestinacao.has(d);
                      const count = fila.filter(i=>i.DESTINACAO===d).length;
                      const cor = d==="RECICLAGEM"?"#22c55e":"#60a5fa";
                      return <button key={d} onClick={() => toggleSet(setFiltroDestinacao,d)}
                        style={{ padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:ativo?700:400, cursor:"pointer", border:`1px solid ${ativo?cor:"#d1d5db"}`, background:ativo?`${cor}18`:"transparent", color:ativo?cor:"#374151", display:"flex", alignItems:"center", gap:5 }}>
                        {ativo&&"✓ "}{d} <span style={{ opacity:.6, fontSize:10 }}>({count})</span>
                      </button>;
                    })}
                  </div>
                </div>
                {/* Flags */}
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:7 }}>🏷 Flags e situações especiais</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {[
                      { key:"FIB",          label:"FIB Expedida",          cor:"#22c55e" },
                      { key:"CEB_TEP_TIV",  label:"CEB/TEP/TIV",           cor:"#60a5fa" },
                      { key:"OFICIO_BAIXA", label:"Ofício de Baixa DETRAN", cor:"#f472b6" },
                      { key:"HIGEIA",       label:"Em Diligência HIGEIA",   cor:"#a78bfa" },
                    ].map(({key,label,cor}) => {
                      const ativo = filtroFlags.has(key);
                      const count = fila.filter(i=>flagAtiva(i,key)).length;
                      return <button key={key} onClick={() => toggleSet(setFiltroFlags,key)}
                        style={{ padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:ativo?700:400, cursor:"pointer", border:`1px solid ${ativo?cor:"#d1d5db"}`, background:ativo?`${cor}18`:"transparent", color:ativo?cor:"#374151", display:"flex", alignItems:"center", gap:5 }}>
                        {ativo&&"✓ "}{label} <span style={{ opacity:.6, fontSize:10 }}>({count})</span>
                      </button>;
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Chips ativos condensados */}
            {!filtrosAbertos && totalFiltrosAtivos > 0 && (
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:8 }}>
                {[...filtroStatus].map(s=><span key={s} onClick={()=>toggleSet(setFiltroStatus,s)} style={{ padding:"3px 9px", background:"rgba(37,99,235,0.08)", border:"1.5px solid #b0b8c4", borderRadius:20, fontSize:11, color:"#2563eb", cursor:"pointer" }}>{s} ✕</span>)}
                {[...filtroLista].map(l=>{const m=LISTA_META[l];return <span key={l} onClick={()=>toggleSet(setFiltroLista,l)} style={{ padding:"3px 9px", background:m?.bg||"#f3f4f6", border:`1px solid ${m?.color||"#9ca3af"}`, borderRadius:20, fontSize:11, color:m?.color||"#fff", cursor:"pointer" }}>{m?.label||l} ✕</span>;})}
                {[...filtroTipo].map(t=><span key={t} onClick={()=>toggleSet(setFiltroTipo,t)} style={{ padding:"3px 9px", background:"#f3f4f6", border:"1px solid #d1d5db", borderRadius:20, fontSize:11, color:"#1f2937", cursor:"pointer" }}>{t} ✕</span>)}
                {[...filtroFlags].map(f=>{const labels={FIB:"FIB",CEB_TEP_TIV:"CEB/TEP/TIV",OFICIO_BAIXA:"Ofício Baixa",HIGEIA:"HIGEIA"};return <span key={f} onClick={()=>toggleSet(setFiltroFlags,f)} style={{ padding:"3px 9px", background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:20, fontSize:11, color:"#a78bfa", cursor:"pointer" }}>{labels[f]||f} ✕</span>;})}
                {[...filtroDestinacao].map(d=><span key={d} onClick={()=>toggleSet(setFiltroDestinacao,d)} style={{ padding:"3px 9px", background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.3)", borderRadius:20, fontSize:11, color:"#16a34a", cursor:"pointer" }}>{d} ✕</span>)}
              </div>
            )}
          </div>

          {/* ── Tabela ── */}
          {sorted.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#6b7280" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
              <div style={{ fontSize:14 }}>Nenhum bem encontrado com estes filtros.</div>
            </div>
          ) : (
            <div style={{ background:"#f9fafb", border:"1.5px solid #b0b8c4", borderRadius:10, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#f3f4f6", borderBottom:"1px solid #e5e7eb" }}>
                    {[
                      { col:"id",               label:"ID",           w:120 },
                      { col:"ID_PASEI",          label:"Processo",     w:200 },
                      { col:"TIPO_BEM",          label:"Tipo",         w:100 },
                      { col:"STATUS_DILIGENCIA", label:"Status",       w:160 },
                      { col:"listaOrigem",       label:"Lista",        w:90  },
                      { col:"NIV",               label:"NIV / Chassi", w:160 },
                      { col:"ULTIMA_ANALISE",    label:"Última atualiz.", w:130 },
                      { col:"obs",               label:"Observações",  w:260 },
                      { col:"flags",             label:"Flags",        w:110 },
                    ].map(({col,label,w}) => (
                      <th key={col} onClick={!["flags","obs"].includes(col)?()=>toggleSort(col):undefined}
                        style={{ padding:"9px 12px", textAlign:"left", fontSize:10, fontWeight:700, color: sortCol===col?"#2563eb":"#4b5563", textTransform:"uppercase", letterSpacing:".07em", cursor:!["flags","obs"].includes(col)?"pointer":"default", userSelect:"none", width:w, whiteSpace:"nowrap" }}>
                        {label}{sortCol===col ? (sortDir==="asc"?" ↑":" ↓") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item, idx) => {
                    const meta   = LISTA_META[item.listaOrigem] || {};
                    const sMeta  = STATUS_META[item.STATUS_DILIGENCIA] || { color:"#4b5563", bg:"transparent" };
                    const isSEI  = item.listaOrigem === "CAIXA_SEI";
                    const ultimaStr = item.ULTIMA_ANALISE
                      ? (() => { const d=new Date(item.ULTIMA_ANALISE); return isNaN(d)?item.ULTIMA_ANALISE:d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit"})+"\n"+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); })()
                      : "—";
                    const flags = [];
                    if (item.FIB==="TRUE"||item.FIB===true)              flags.push({t:"FIB",c:"#22c55e"});
                    if (item.CEB_TEP_TIV==="TRUE"||item.CEB_TEP_TIV===true) flags.push({t:"CEB",c:"#60a5fa"});
                    if (item.OFICIO_BAIXA==="TRUE"||item.OFICIO_BAIXA===true) flags.push({t:"OF.BX",c:"#f472b6"});
                    const rInfo = renajudInfo(item);
                    if (rInfo) flags.push(rInfo.pendentes > 0
                      ? { t:`🔒 ${rInfo.pendentes}p`, c:"#f59e0b" }
                      : { t:"🔒 ✓", c:"#22c55e" });
                    return (
                      <tr key={item.id} onClick={() => abrirDrawer(item)}
                        style={{ borderBottom:"1px solid #f3f4f6", cursor:"pointer", background: idx%2===0?"transparent":"#fafafa", transition:"background 0.1s" }}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(37,99,235,0.05)"}
                        onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?"transparent":"#fafafa"}>
                        <td style={{ padding:"9px 12px", fontSize:11, fontFamily:"monospace", color:"#2563eb", fontWeight:700, whiteSpace:"nowrap" }}>{item.id}</td>
                        <td style={{ padding:"9px 12px", fontSize:11, fontFamily:"monospace", color:"#1f2937" }}>{item.ID_PASEI||"—"}</td>
                        <td style={{ padding:"9px 12px", fontSize:12 }}>{(TIPO_ICON[item.TIPO_BEM]||"")+" "+(item.TIPO_BEM||"—")}</td>
                        <td style={{ padding:"9px 12px" }}>
                          <span style={{ padding:"2px 8px", borderRadius:12, fontSize:11, fontWeight:700, background:sMeta.bg, color:sMeta.color, whiteSpace:"nowrap" }}>
                            {item.STATUS_DILIGENCIA||"—"}
                          </span>
                        </td>
                        <td style={{ padding:"9px 12px" }}>
                          <span style={{ padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, background:meta.bg, color:meta.color, whiteSpace:"nowrap" }}>{meta.label||item.listaOrigem}</span>
                        </td>
                        <td style={{ padding:"9px 12px", fontSize:11, fontFamily:"monospace", color:"#374151" }}>{item.NIV||"—"}</td>
                        <td style={{ padding:"9px 12px", fontSize:11, color:"#4b5563", whiteSpace:"pre-line", lineHeight:1.3 }}>{ultimaStr}</td>
                        <td style={{ padding:"9px 12px", fontSize:11, color:"#4b5563", lineHeight:1.35, maxWidth:260 }} title={ultimaObs(item.OBSERVACOES)}>
                          <div style={{ display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                            {ultimaObs(item.OBSERVACOES) || "—"}
                          </div>
                        </td>
                        <td style={{ padding:"9px 12px" }}>
                          <div style={{ display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>
                            {isSEI && item.STATUS_DILIGENCIA !== "ARQUIVADO" && (
                              <button onClick={e => concluirSEI(item, e)}
                                style={{ padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:700, background:"rgba(34,197,94,0.1)", color:"#22c55e", border:"1px solid rgba(34,197,94,0.4)", cursor:"pointer", whiteSpace:"nowrap" }}>
                                ✓ Arquivar
                              </button>
                            )}
                            {flags.map(f=>(
                              <span key={f.t} style={{ padding:"1px 6px", borderRadius:10, fontSize:10, fontWeight:700, background:`${f.c}18`, color:f.c, border:`1px solid ${f.c}44` }}>{f.t}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── DETAIL DRAWER ── */}
      {selectedItem && (
        <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex" }}>
          <div onClick={() => { setSelectedItem(null); setDrawerEditMode(false); }}
            style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)" }}/>
          <div style={{ position:"absolute", right:0, top:0, bottom:0, width:460, background:"#fff", borderLeft:"1.5px solid #b0b8c4", display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Header */}
            <div style={{ padding:"18px 22px", borderBottom:"1px solid #e5e7eb", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div>
                <div style={{ fontSize:10, color:"#374151", letterSpacing:".08em", textTransform:"uppercase", marginBottom:3 }}>
                  {LISTA_META[selectedItem.listaOrigem]?.label} · {selectedItem.id}
                  {drawerEditMode && <span style={{ marginLeft:8, color:"#2563eb", background:"rgba(37,99,235,0.1)", border:"1.5px solid #b0b8c4", borderRadius:4, padding:"1px 7px", fontSize:9 }}>EDITANDO</span>}
                </div>
                <div style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>{TIPO_ICON[selectedItem.TIPO_BEM]} {selectedItem.TIPO_BEM}</div>
              </div>
              <button onClick={() => { setSelectedItem(null); setDrawerEditMode(false); }}
                style={{ background:"#e5e7eb", border:"none", borderRadius:8, width:30, height:30, color:"#374151", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>

            {/* Toast */}
            {drawerToast && (
              <div style={{ padding:"10px 22px", background: drawerToast.tipo==="ok"?"rgba(34,197,94,0.12)":"rgba(248,113,113,0.12)", borderBottom:`1px solid ${drawerToast.tipo==="ok"?"rgba(34,197,94,0.3)":"rgba(248,113,113,0.3)"}`, fontSize:12, color: drawerToast.tipo==="ok"?"#22c55e":"#f87171", fontWeight:600 }}>
                {drawerToast.tipo==="ok"?"✓":"⚠"} {drawerToast.msg}
              </div>
            )}

            {/* Body */}
            <div style={{ flex:1, overflow:"auto", padding:"20px 22px" }}>

              {/* ── MODO VISUALIZAÇÃO ── */}
              {!drawerEditMode && (() => {
                const sMeta = STATUS_META[selectedItem.STATUS_DILIGENCIA] || { color:"#374151", bg:"transparent" };
                return (
                  <>
                    {/* Campos principais */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
                      {[
                        ["Processo (ID_PASEI)", selectedItem.ID_PASEI, true],
                        ["Status",             selectedItem.STATUS_DILIGENCIA],
                        ["Tipo de Bem",        selectedItem.TIPO_BEM],
                        ["Destinação",         selectedItem.DESTINACAO],
                        selectedItem.NIV  && ["NIV / Chassi", selectedItem.NIV, true],
                        selectedItem.LOTE && ["Lote DPJ", `#${selectedItem.LOTE}`],
                        selectedItem.ULTIMA_ANALISE && ["Última atualização", (() => { const d=new Date(selectedItem.ULTIMA_ANALISE); return isNaN(d)?"—":d.toLocaleString("pt-BR"); })()],
                      ].filter(Boolean).map(([label, val, mono]) => (
                        <div key={label}>
                          <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:".08em", marginBottom:4 }}>{label}</div>
                          <div style={{ fontSize:12, fontFamily:mono?"monospace":"inherit", color:"#0f172a", fontWeight:500 }}>{val||"—"}</div>
                        </div>
                      ))}
                    </div>

                    {/* Flags */}
                    <div style={{ marginBottom:20 }}>
                      <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>🏷 Flags</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {[
                          { field:"FIB",          label:"FIB Expedida",     cor:"#22c55e" },
                          { field:"CEB_TEP_TIV",  label:"CEB/TEP/TIV",      cor:"#60a5fa" },
                          { field:"OFICIO_BAIXA",  label:"Ofício de Baixa",  cor:"#f472b6" },
                          { field:"RESTRICAO_ROUBO",label:"Restrição Roubo", cor:"#fbbf24" },
                        ].map(({field,label,cor}) => {
                          const on = selectedItem[field]==="TRUE"||selectedItem[field]===true;
                          return (
                            <span key={field} style={{ padding:"3px 10px", borderRadius:16, fontSize:11, fontWeight:700, background:on?`${cor}18`:"#f3f4f6", border:`1px solid ${on?cor:"#d1d5db"}`, color:on?cor:"#6b7280" }}>
                              {on?"✓ ":""}{label}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Observações — mais recente primeiro */}
                    {selectedItem.OBSERVACOES && (
                      <div style={{ marginBottom:20 }}>
                        <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>Observações</div>
                        <div style={{ background:"#f9fafb", border:"1.5px solid #b0b8c4", borderRadius:8, padding:"6px 12px", maxHeight:200, overflow:"auto" }}>
                          {parseNotas(selectedItem.OBSERVACOES).map((n, i) => (
                            <div key={i} style={{ padding:"7px 0", borderBottom: i < parseNotas(selectedItem.OBSERVACOES).length-1 ? "1px solid #eef0f2" : "none" }}>
                              {(n.ts || n.autor) && (
                                <div style={{ fontSize:10, color:"#6b7280", marginBottom:2 }}>
                                  {n.autor && <b style={{ color:"#2563eb" }}>{n.autor}</b>}{n.autor && n.ts ? " · " : ""}{n.ts}
                                </div>
                              )}
                              <div style={{ fontSize:12, color:"#1f2937", lineHeight:1.5, whiteSpace:"pre-wrap" }}>{n.texto}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Link para detalhes completos */}
                    <button onClick={() => { const cfg=LISTAS_FILA.find(l=>l.key===selectedItem.listaOrigem); if(cfg) window.location.href=`/detalhes?lista=${cfg.rota}&row=${selectedItem._rowNumber}`; }}
                      style={{ width:"100%", padding:"9px", background:"#f9fafb", border:"1.5px solid #b0b8c4", borderRadius:8, color:"#4b5563", fontSize:12, cursor:"pointer" }}>
                      🔗 Abrir detalhes completos →
                    </button>
                  </>
                );
              })()}

              {/* ── MODO EDIÇÃO ── */}
              {drawerEditMode && drawerEditData && (() => {
                const inp = (label, field, opts) => (
                  <div key={field}>
                    <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:".08em", marginBottom:5 }}>{label}</div>
                    {opts ? (
                      <select value={drawerEditData[field]||""} onChange={e=>updDrawer(field,e.target.value)}
                        style={{ width:"100%", padding:"7px 10px", background:"#fff", border:"1px solid #d1d5db", borderRadius:7, color:"#0f172a", fontSize:12, outline:"none" }}>
                        <option value="">— Selecione —</option>
                        {opts.map(o=><option key={o} value={o} style={{background:"#fff",color:"#111827"}}>{o}</option>)}
                      </select>
                    ) : (
                      <input value={drawerEditData[field]||""} onChange={e=>updDrawer(field,e.target.value)}
                        style={{ width:"100%", padding:"7px 10px", background:"#fff", border:"1px solid #d1d5db", borderRadius:7, color:"#0f172a", fontSize:12, outline:"none", boxSizing:"border-box" }}/>
                    )}
                  </div>
                );

                const tog = (label, field, cor="#22c55e") => {
                  const on = drawerEditData[field]==="TRUE"||drawerEditData[field]===true;
                  return (
                    <div key={field} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", background:"#f9fafb", border:`1px solid ${on?cor+"44":"#e5e7eb"}`, borderRadius:8, cursor:"pointer" }}
                      onClick={()=>updDrawer(field, on?"FALSE":"TRUE")}>
                      <span style={{ fontSize:13, color:on?cor:"#374151", fontWeight:on?600:400 }}>{on?"✓ ":""}{label}</span>
                      <div style={{ width:36, height:20, borderRadius:10, background:on?cor:"#d1d5db", position:"relative", transition:"background .2s" }}>
                        <div style={{ position:"absolute", top:2, left:on?18:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }}/>
                      </div>
                    </div>
                  );
                };

                return (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {inp("Status", "STATUS_DILIGENCIA", statusOptions)}
                    {inp("Destinação", "DESTINACAO", DESTINACOES_OPT)}
                    {inp("NIV / Chassi", "NIV")}
                    {(selectedItem.listaOrigem==="PCDF_1HIGEIA"||selectedItem.listaOrigem==="PCDF_2HIGEIA") && inp("Nº SEI do TEP","TEP_SEI")}
                    {(selectedItem.listaOrigem==="PCDF_1HIGEIA"||selectedItem.listaOrigem==="PCDF_2HIGEIA") && inp("Valor TEP (R$)","TEP_VALOR")}
                    <div style={{ borderTop:"1px solid #e5e7eb", paddingTop:8, display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:".08em", marginBottom:2 }}>Flags</div>
                      {tog("FIB Expedida",       "FIB",           "#22c55e")}
                      {tog("CEB/TEP/TIV Emitido","CEB_TEP_TIV",   "#60a5fa")}
                      {tog("Ofício de Baixa DETRAN","OFICIO_BAIXA","#f472b6")}
                      {tog("Restrição Roubo/Furto","RESTRICAO_ROUBO","#fbbf24")}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div style={{ padding:"14px 22px", borderTop:"1px solid #e5e7eb", display:"flex", gap:8, flexShrink:0 }}>
              {!drawerEditMode ? (
                <>
                  <button onClick={iniciarEdicao}
                    style={{ flex:1, padding:"10px", background:"rgba(37,99,235,0.1)", border:"1px solid rgba(37,99,235,0.3)", borderRadius:8, color:"#2563eb", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                    ✏️ Editar campos
                  </button>
                  <button onClick={() => { setSelectedItem(null); }}
                    style={{ padding:"10px 14px", background:"#f3f4f6", border:"1.5px solid #b0b8c4", borderRadius:8, color:"#4b5563", fontSize:13, cursor:"pointer" }}>
                    Fechar
                  </button>
                </>
              ) : (
                <>
                  <button onClick={salvarDrawer} disabled={drawerSalvando}
                    style={{ flex:1, padding:"10px", background:"rgba(34,197,94,0.12)", border:"1px solid rgba(34,197,94,0.4)", borderRadius:8, color:"#22c55e", fontSize:13, fontWeight:700, cursor:"pointer", opacity:drawerSalvando?.5:1 }}>
                    {drawerSalvando ? "Salvando…" : "✓ Salvar alterações"}
                  </button>
                  <button onClick={cancelarEdicao} disabled={drawerSalvando}
                    style={{ padding:"10px 14px", background:"#f3f4f6", border:"1.5px solid #b0b8c4", borderRadius:8, color:"#4b5563", fontSize:13, cursor:"pointer" }}>
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
