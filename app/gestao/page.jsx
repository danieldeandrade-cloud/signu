"use client";
import Sidebar from "@/components/Sidebar";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// Exportação para Excel sem dependência externa (CSV com extensão .xls abre no Excel)
function exportarExcel(dados, nomeArquivo) {
  if (!dados.length) return;
  const cols = Object.keys(dados[0]).filter(k => k !== "_rowNumber");
  const header = cols.join("\t");
  const rows = dados.map(r => cols.map(c => {
    const v = r[c] ?? "";
    return String(v).replace(/\t/g, " ").replace(/\n/g, " ");
  }).join("\t"));
  const tsv = [header, ...rows].join("\n");
  const blob = new Blob(["﻿" + tsv], { type: "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo + ".xls";
  a.click();
  URL.revokeObjectURL(url);
}

// Mapa: chave da aba → rota da API
const LISTA_API_MAP = {
  CEGOC:        "cegoc",
  PCDF_1HIGEIA: "pcdf1",
  PCDF_2HIGEIA: "pcdf2",
  DPJ_GC99:     "dpj",
  DOACOES:      "doacoes_diligencia",
  CAIXA_SEI:    "sei",
};

const LISTAS_TABS = [
  { key:"CEGOC",        label:"CEGOC",     color:"#3b82f6", bg:"#1e3a5f", icon:"🏛️" },
  { key:"PCDF_1HIGEIA", label:"PCDF 1ª",  color:"#a78bfa", bg:"#3b1f5f", icon:"🚔" },
  { key:"PCDF_2HIGEIA", label:"PCDF 2ª",  color:"#c084fc", bg:"#4a1f6f", icon:"🚔" },
  { key:"DPJ_GC99",     label:"DPJ-GC99", color:"#fb923c", bg:"#5f2a0e", icon:"⚖️" },
  { key:"DOACOES",      label:"Doações",  color:"#34d399", bg:"#064e3b", icon:"🤝" },
  { key:"CAIXA_SEI",    label:"Caixa SEI",color:"#fbbf24", bg:"#451a03", icon:"📬" },
];

const STATUS_META = {
  "EM DILIGÊNCIA":      { color:"#22c55e", bg:"rgba(34,197,94,0.12)"   },
  "AGUARDANDO":         { color:"#60a5fa", bg:"rgba(96,165,250,0.12)"  },
  "ATRASADO":           { color:"#f87171", bg:"rgba(248,113,113,0.12)" },
  "PRAZO 6 MESES":      { color:"#fbbf24", bg:"rgba(251,191,36,0.12)"  },
  "BAIXADO":            { color:"#6b7280", bg:"rgba(107,114,128,0.12)" },
  "EM ANÁLISE":         { color:"#60a5fa", bg:"rgba(96,165,250,0.12)"  },
  "AGUARDANDO ENTIDADE":{ color:"#fbbf24", bg:"rgba(251,191,36,0.12)"  },
  "DILIGÊNCIA":         { color:"#22c55e", bg:"rgba(34,197,94,0.12)"   },
  "AGUARDAR RETORNO":   { color:"#fbbf24", bg:"rgba(251,191,36,0.12)"  },
  "ENCAMINHAR":         { color:"#a78bfa", bg:"rgba(167,139,250,0.12)" },
};

const TIPO_ICON = { CARRO:"🚗", MOTO:"🏍️", CAMINHONETE:"🛻", "CAMINHÃO":"🚛", REBOQUE:"🚜", OUTROS:"📦" };

const FLAGS_CONFIG = [
  { key:"FIB",            label:"FIB",            color:"#22c55e", bg:"rgba(34,197,94,0.15)"    },
  { key:"CEB_TEP_TIV",   label:"CEB/TEP/TIV",   color:"#60a5fa", bg:"rgba(96,165,250,0.15)"   },
  { key:"RESTRICAO_ROUBO",label:"🔒 Roubo/Furto",color:"#f87171", bg:"rgba(248,113,113,0.15)"  },
  { key:"OFICIO_BAIXA",  label:"Ofício Baixa",   color:"#a78bfa", bg:"rgba(167,139,250,0.15)"  },
  { key:"INUTILIZADO",   label:"Inutilizado",    color:"#fbbf24", bg:"rgba(251,191,36,0.15)"   },
];

function hasFlag(item, key) {
  const v = item[key];
  return v === true || v === "TRUE" || v === "Sim";
}

// Extrai o campo de status conforme a lista ativa
function getStatus(item, listaKey) {
  if (listaKey === "DOACOES")   return item.STATUS_LOCAL_PA;
  if (listaKey === "CAIXA_SEI") return item.ACAO;
  return item.STATUS_DILIGENCIA;
}

// Gera um ID de exibição caso o campo não exista na planilha
function displayId(item, listaKey) {
  if (item.ID_LEGADO) return item.ID_LEGADO;
  const prefixo = listaKey.split("_")[0];
  return `${prefixo}-${String(item._rowNumber).padStart(4, "0")}`;
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { color:"#6b7280", bg:"rgba(107,114,128,0.12)" };
  return (
    <span style={{ fontSize:10, fontWeight:700, color:m.color, background:m.bg, padding:"3px 8px", borderRadius:20, border:`1px solid ${m.color}33`, whiteSpace:"nowrap" }}>
      {status || "—"}
    </span>
  );
}

function Cell({ children, mono, right, muted }) {
  return (
    <td style={{
      padding:"11px 14px", fontSize:12,
      fontFamily: mono ? "'IBM Plex Mono',monospace" : "inherit",
      color: muted ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.8)",
      textAlign: right ? "center" : "left",
      borderBottom:"1px solid rgba(255,255,255,0.04)",
      whiteSpace:"nowrap",
    }}>{children}</td>
  );
}

function Spinner({ color }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 0", gap:16 }}>
      <div style={{ width:36, height:36, border:`3px solid ${color}30`, borderTop:`3px solid ${color}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>Carregando dados da planilha…</span>
    </div>
  );
}

export default function GestaoPage() {
  const router = useRouter();
  const [abaAtiva, setAbaAtiva]     = useState("CEGOC");
  const [dados, setDados]           = useState([]);
  const [contagens, setContagens]   = useState({});
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [busca, setBusca]           = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroFlags, setFiltroFlags]   = useState(new Set());
  const [filtroSemFib, setFiltroSemFib] = useState(false);
  const [ordenacao, setOrdenacao]   = useState({ campo:"_rowNumber", dir:"asc" });
  const [pag, setPag]               = useState(1);
  const POR_PAGINA = 15;

  const tab = LISTAS_TABS.find(t => t.key === abaAtiva);

  // Busca dados da aba ativa
  const fetchAba = useCallback(async (listaKey) => {
    const rota = LISTA_API_MAP[listaKey];
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bens/${rota}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Erro ao buscar dados");
      setDados(json.dados || []);
      setContagens(prev => ({ ...prev, [listaKey]: json.total }));
    } catch (e) {
      setError(e.message);
      setDados([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAba(abaAtiva);
    setBusca("");
    setFiltroStatus("TODOS");
    setFiltroFlags(new Set());
    setFiltroSemFib(false);
    setPag(1);
  }, [abaAtiva, fetchAba]);

  // Filtragem e ordenação
  const filtrados = useMemo(() => {
    let res = [...dados];
    if (busca.trim()) {
      const q = busca.toLowerCase();
      res = res.filter(i =>
        i.ID_PASEI?.toLowerCase().includes(q) ||
        i.ID_LEGADO?.toLowerCase().includes(q) ||
        i.NIV?.toLowerCase().includes(q) ||
        (i.RESPONSAVEL || i.Responsavel || "").toLowerCase().includes(q) ||
        i.TIPO_BEM?.toLowerCase().includes(q) ||
        (i.ENTIDADE_NOME || i.ENTIDADE || "").toLowerCase().includes(q)
      );
    }
    if (filtroStatus !== "TODOS") {
      res = res.filter(i => getStatus(i, abaAtiva) === filtroStatus);
    }
    if (filtroFlags.size > 0) {
      res = res.filter(i => [...filtroFlags].every(flag => hasFlag(i, flag)));
    }
    if (filtroSemFib) {
      res = res.filter(i => !hasFlag(i, "FIB"));
    }
    res.sort((a, b) => {
      const va = a[ordenacao.campo] ?? "";
      const vb = b[ordenacao.campo] ?? "";
      const r = typeof va === "string" ? va.localeCompare(vb, "pt-BR") : Number(va) - Number(vb);
      return ordenacao.dir === "asc" ? r : -r;
    });
    return res;
  }, [dados, busca, filtroStatus, filtroFlags, filtroSemFib, ordenacao, abaAtiva]);

  const totalPags = Math.ceil(filtrados.length / POR_PAGINA);
  const pagina = filtrados.slice((pag-1)*POR_PAGINA, pag*POR_PAGINA);

  const ordeBy = (campo) => {
    setOrdenacao(o => ({ campo, dir: o.campo===campo && o.dir==="desc" ? "asc" : "desc" }));
    setPag(1);
  };

  const ThSort = ({ campo, children }) => (
    <th onClick={() => ordeBy(campo)} style={{ padding:"10px 14px", fontSize:10, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, textAlign:"left", cursor:"pointer", whiteSpace:"nowrap", userSelect:"none", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
      {children} {ordenacao.campo===campo ? (ordenacao.dir==="asc" ? "↑" : "↓") : <span style={{ opacity:0.3 }}>↕</span>}
    </th>
  );

  const statusOptions = [...new Set(dados.map(i => getStatus(i, abaAtiva)).filter(Boolean))].sort();

  // Flags disponíveis na lista ativa (só exibe pill se houver ao menos 1 item com a flag)
  const flagsDisponiveis = FLAGS_CONFIG.filter(f => dados.some(i => hasFlag(i, f.key)));

  const toggleFlag = (key) => {
    setFiltroFlags(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setPag(1);
  };

  const stats = useMemo(() => {
    const total     = dados.length;
    const atrasados = dados.filter(i => getStatus(i, abaAtiva) === "ATRASADO").length;
    const emDilig   = dados.filter(i => getStatus(i, abaAtiva) === "EM DILIGÊNCIA").length;
    const aguardando= dados.filter(i => getStatus(i, abaAtiva) === "AGUARDANDO").length;
    return { total, atrasados, emDilig, aguardando };
  }, [dados, abaAtiva]);

  return (
    <div className="signu-layout" style={{ background:"#060f1e", fontFamily:"'Inter',system-ui,sans-serif", color:"#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.2);border-radius:4px}
        tr:hover td{background:rgba(255,255,255,0.025)!important}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <Sidebar />

      <main className="signu-main">

        {/* Top bar */}
        <header style={{ height:56, borderBottom:"1px solid rgba(201,168,76,0.1)", background:"#0a1628", display:"flex", alignItems:"center", padding:"0 24px", gap:12, flexShrink:0 }}>
          <span style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>SIGNU</span>
          <span style={{ color:"rgba(255,255,255,0.15)" }}>/</span>
          <span style={{ fontSize:13, fontWeight:700, color:"#fff" }}>Gestão</span>
          <span style={{ color:"rgba(255,255,255,0.15)" }}>/</span>
          <span style={{ fontSize:12, fontWeight:700, color:tab.color, background:tab.bg, padding:"2px 10px", borderRadius:4 }}>{tab.label}</span>
          <div style={{ flex:1 }}/>
          {loading ? (
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:10, height:10, border:`2px solid ${tab.color}40`, borderTop:`2px solid ${tab.color}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
              Carregando…
            </span>
          ) : (
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)", fontFamily:"'IBM Plex Mono',monospace" }}>
              {filtrados.length} registro{filtrados.length!==1?"s":""}
            </span>
          )}
          <button
            onClick={() => exportarExcel(filtrados, `SIGNU_${tab.label}${filtroSemFib?"_SemFIB":""}_${new Date().toISOString().slice(0,10)}`)}
            disabled={filtrados.length === 0}
            title="Exportar dados filtrados para Excel"
            style={{ padding:"5px 10px", background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:6, color:"#22c55e", fontSize:11, cursor:filtrados.length===0?"not-allowed":"pointer", fontWeight:600, opacity:filtrados.length===0?0.4:1 }}>
            ⬇ Excel
          </button>
          <button onClick={() => fetchAba(abaAtiva)} title="Recarregar da planilha"
            style={{ padding:"5px 10px", background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:6, color:"#c9a84c", fontSize:11, cursor:"pointer", fontWeight:600 }}>
            ↻ Atualizar
          </button>
        </header>

        {/* ABAS */}
        <div style={{ background:"#0a1628", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"0 24px", display:"flex", gap:0, flexShrink:0, overflowX:"auto" }}>
          {LISTAS_TABS.map(t => (
            <button key={t.key} onClick={() => setAbaAtiva(t.key)}
              style={{
                padding:"12px 18px", border:"none", background:"transparent", cursor:"pointer",
                fontSize:12, fontWeight:abaAtiva===t.key?700:400, whiteSpace:"nowrap",
                color:abaAtiva===t.key?t.color:"rgba(255,255,255,0.4)",
                borderBottom:abaAtiva===t.key?`2px solid ${t.color}`:"2px solid transparent",
                transition:"all 0.15s", display:"flex", alignItems:"center", gap:6,
              }}>
              {t.icon} {t.label}
              <span style={{ fontSize:10, background:abaAtiva===t.key?t.bg:"rgba(255,255,255,0.06)", color:abaAtiva===t.key?t.color:"rgba(255,255,255,0.4)", padding:"1px 6px", borderRadius:10, fontWeight:700 }}>
                {contagens[t.key] ?? (abaAtiva===t.key && loading ? "…" : "—")}
              </span>
            </button>
          ))}
        </div>

        <div className="signu-content" style={{ padding:"20px 24px 32px" }}>

          {/* Stats rápidos */}
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
            {[
              { label:"Total",        value:stats.total,     color:tab.color },
              { label:"Em Diligência",value:stats.emDilig,   color:"#22c55e" },
              { label:"Aguardando",   value:stats.aguardando,color:"#60a5fa" },
              { label:"Atrasados",    value:stats.atrasados, color:"#f87171" },
            ].map(s => (
              <div key={s.label} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8, padding:"7px 14px" }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:s.color, flexShrink:0 }}/>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{s.label}</span>
                <span style={{ fontSize:14, fontWeight:800, color:"#fff" }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Barra de filtros */}
          <div style={{ display:"flex", gap:10, marginBottom:12, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ position:"relative", flex:1, minWidth:200, maxWidth:320 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }}>
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
              </svg>
              <input value={busca} onChange={e=>{setBusca(e.target.value);setPag(1);}}
                placeholder="Buscar por PA, NIV, responsável, tipo…"
                style={{ width:"100%", padding:"8px 10px 8px 32px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#fff", fontSize:12, outline:"none" }}/>
            </div>
            <select value={filtroStatus} onChange={e=>{setFiltroStatus(e.target.value);setPag(1);}}
              style={{ padding:"8px 12px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"rgba(255,255,255,0.7)", fontSize:12, cursor:"pointer", outline:"none" }}>
              <option value="TODOS" style={{ background:"#0a1628" }}>Todos os status</option>
              {statusOptions.map(s => <option key={s} value={s} style={{ background:"#0a1628" }}>{s}</option>)}
            </select>
            {(busca || filtroStatus!=="TODOS" || filtroFlags.size > 0) && (
              <button onClick={()=>{setBusca("");setFiltroStatus("TODOS");setFiltroFlags(new Set());setPag(1);}}
                style={{ padding:"7px 12px", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:8, color:"#f87171", fontSize:11, cursor:"pointer", fontWeight:600 }}>
                ✕ Limpar
              </button>
            )}
          </div>

          {/* Filtro por flags */}
          {(flagsDisponiveis.length > 0 || abaAtiva === "CEGOC" || abaAtiva === "PCDF_1HIGEIA" || abaAtiva === "PCDF_2HIGEIA") && (
            <div style={{ display:"flex", gap:6, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.08em", marginRight:2 }}>🏷 Flags:</span>
              {flagsDisponiveis.map(f => {
                const ativo = filtroFlags.has(f.key);
                const count = dados.filter(i => hasFlag(i, f.key)).length;
                return (
                  <button key={f.key} onClick={()=>toggleFlag(f.key)} style={{
                    display:"flex", alignItems:"center", gap:5,
                    padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:ativo?700:400,
                    cursor:"pointer", transition:"all 0.15s",
                    border:`1px solid ${ativo ? f.color : "rgba(255,255,255,0.1)"}`,
                    background: ativo ? f.bg : "transparent",
                    color: ativo ? f.color : "rgba(255,255,255,0.45)",
                  }}>
                    {f.label}
                    <span style={{ fontSize:10, background:ativo?f.color+"33":"rgba(255,255,255,0.08)", color:ativo?f.color:"rgba(255,255,255,0.35)", padding:"1px 5px", borderRadius:10, fontWeight:700 }}>{count}</span>
                  </button>
                );
              })}
              {/* Filtro especial: Sem FIB */}
              {(abaAtiva === "CEGOC" || abaAtiva === "PCDF_1HIGEIA" || abaAtiva === "PCDF_2HIGEIA") && (
                <button onClick={()=>{ setFiltroSemFib(v=>!v); setPag(1); }} style={{
                  display:"flex", alignItems:"center", gap:5,
                  padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:filtroSemFib?700:400,
                  cursor:"pointer", transition:"all 0.15s",
                  border:`1px solid ${filtroSemFib ? "#f87171" : "rgba(255,255,255,0.1)"}`,
                  background: filtroSemFib ? "rgba(248,113,113,0.15)" : "transparent",
                  color: filtroSemFib ? "#f87171" : "rgba(255,255,255,0.45)",
                }}>
                  ⚠️ Sem FIB
                  <span style={{ fontSize:10, background:filtroSemFib?"rgba(248,113,113,0.2)":"rgba(255,255,255,0.08)", color:filtroSemFib?"#f87171":"rgba(255,255,255,0.35)", padding:"1px 5px", borderRadius:10, fontWeight:700 }}>
                    {dados.filter(i => !hasFlag(i, "FIB")).length}
                  </span>
                </button>
              )}
              {(filtroFlags.size > 0 || filtroSemFib) && (
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginLeft:4 }}>
                  — mostrando {filtrados.length} de {dados.length}
                </span>
              )}
            </div>
          )}

          {/* Erro */}
          {error && (
            <div style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:10, padding:"14px 18px", marginBottom:16, color:"#f87171", fontSize:12, display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:16 }}>⚠️</span>
              <div>
                <div style={{ fontWeight:700, marginBottom:2 }}>Erro ao carregar dados</div>
                <div style={{ opacity:0.7 }}>{error}</div>
              </div>
              <button onClick={() => fetchAba(abaAtiva)} style={{ marginLeft:"auto", padding:"5px 12px", background:"rgba(248,113,113,0.2)", border:"1px solid rgba(248,113,113,0.4)", borderRadius:6, color:"#f87171", fontSize:11, cursor:"pointer", fontWeight:600 }}>Tentar novamente</button>
            </div>
          )}

          {/* TABELA */}
          <div style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, overflow:"hidden" }}>
            {loading ? (
              <Spinner color={tab.color}/>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"rgba(255,255,255,0.02)" }}>
                      <ThSort campo="_rowNumber">ID</ThSort>
                      <ThSort campo="ID_PASEI">ID_PASEI</ThSort>
                      <ThSort campo="TIPO_BEM">Tipo</ThSort>
                      <ThSort campo="NIV">NIV</ThSort>
                      {abaAtiva==="DPJ_GC99"      && <ThSort campo="LOTE">Lote</ThSort>}
                      {abaAtiva==="DPJ_GC99"      && <ThSort campo="PRAZO_6MESES">Prazo 6m</ThSort>}
                      {(abaAtiva==="PCDF_1HIGEIA"||abaAtiva==="PCDF_2HIGEIA") && <ThSort campo="DEPOSITO">Depósito</ThSort>}
                      {abaAtiva==="PCDF_2HIGEIA"  && <ThSort campo="RESTRICAO_ROUBO">Roubo</ThSort>}
                      {abaAtiva==="DOACOES"        && <ThSort campo="ENTIDADE_NOME">Entidade</ThSort>}
                      {abaAtiva==="CEGOC"          && <ThSort campo="DESTINACAO">Destinação</ThSort>}
                      <ThSort campo="STATUS_DILIGENCIA">Status</ThSort>
                      <ThSort campo="Responsavel">Responsável</ThSort>
                      <ThSort campo="OBSERVACOES">Observações</ThSort>
                      <th style={{ padding:"10px 14px", fontSize:10, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagina.length === 0 ? (
                      <tr><td colSpan={12} style={{ padding:"48px", textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:13, fontStyle:"italic" }}>Nenhum registro encontrado.</td></tr>
                    ) : pagina.map((item, ri) => {
                      const status = getStatus(item, abaAtiva);
                      const idDisplay = displayId(item, abaAtiva);
                      const prazoVencido = item.PRAZO_6MESES && new Date(item.PRAZO_6MESES) <= new Date();
                      return (
                        <tr key={item._rowNumber}
                          onClick={() => router.push(`/detalhes?lista=${LISTA_API_MAP[abaAtiva]}&row=${item._rowNumber}`)}
                          style={{ cursor:"pointer", background: ri%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                          <Cell mono><span style={{ color:tab.color, fontWeight:700 }}>{idDisplay}</span></Cell>
                          <Cell mono muted>{item.ID_PASEI ? item.ID_PASEI.substring(0,22)+"…" : "—"}</Cell>
                          <Cell>{TIPO_ICON[item.TIPO_BEM] || "📦"} {item.TIPO_BEM || "—"}</Cell>
                          <Cell mono muted>{item.NIV || "—"}</Cell>
                          {abaAtiva==="DPJ_GC99"      && <Cell right>{item.LOTE ? `#${item.LOTE}` : "—"}</Cell>}
                          {abaAtiva==="DPJ_GC99"      && <Cell mono><span style={{ color: prazoVencido ? "#f87171" : "rgba(255,255,255,0.7)" }}>{item.PRAZO_6MESES || "—"}</span></Cell>}
                          {(abaAtiva==="PCDF_1HIGEIA"||abaAtiva==="PCDF_2HIGEIA") && <Cell muted>{item.DEPOSITO || "—"}</Cell>}
                          {abaAtiva==="PCDF_2HIGEIA"  && <Cell right>{item.RESTRICAO_ROUBO === "TRUE" || item.RESTRICAO_ROUBO === true ? "🔒 Sim" : "—"}</Cell>}
                          {abaAtiva==="DOACOES"        && <Cell muted>{(item.ENTIDADE_NOME || item.ENTIDADE) ? (item.ENTIDADE_NOME || item.ENTIDADE).substring(0,30)+"…" : "—"}</Cell>}
                          {abaAtiva==="CEGOC"          && <Cell muted>{item.DESTINACAO || "—"}</Cell>}
                          <td style={{ padding:"11px 14px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                            <StatusBadge status={status}/>
                          </td>
                          <Cell muted>{(item.RESPONSAVEL || item.Responsavel || "").split(" ")[0] || "—"}</Cell>
                          <td style={{ padding:"11px 14px", fontSize:11, color:"rgba(255,255,255,0.4)", borderBottom:"1px solid rgba(255,255,255,0.04)", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={item.OBSERVACOES || ""}>
                            {item.OBSERVACOES ? item.OBSERVACOES.substring(0,40)+(item.OBSERVACOES.length>40?"…":"") : "—"}
                          </td>
                          <td style={{ padding:"11px 14px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                            <div style={{ display:"flex", gap:4 }}>
                              {(item.FIB === "TRUE" || item.FIB === true || item.FIB === "Sim") &&
                                <span style={{ fontSize:9, background:"rgba(34,197,94,0.15)", color:"#22c55e", padding:"2px 5px", borderRadius:4, fontWeight:700 }}>FIB</span>}
                              {(item.CEB_TEP_TIV === "TRUE" || item.CEB_TEP_TIV === true) &&
                                <span style={{ fontSize:9, background:"rgba(96,165,250,0.15)", color:"#60a5fa", padding:"2px 5px", borderRadius:4, fontWeight:700 }}>CEB</span>}
                              {(item.RESTRICAO_ROUBO === "TRUE" || item.RESTRICAO_ROUBO === true) &&
                                <span style={{ fontSize:9, background:"rgba(248,113,113,0.15)", color:"#f87171", padding:"2px 5px", borderRadius:4, fontWeight:700 }}>🔒</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginação */}
            {!loading && totalPags > 1 && (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>
                  {(pag-1)*POR_PAGINA+1}–{Math.min(pag*POR_PAGINA, filtrados.length)} de {filtrados.length}
                </span>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>setPag(p=>Math.max(1,p-1))} disabled={pag===1}
                    style={{ width:30, height:30, borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:pag===1?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.6)", cursor:pag===1?"default":"pointer", fontSize:14 }}>‹</button>
                  {Array.from({length:Math.min(totalPags,7)},(_,i)=>i+1).map(n=>(
                    <button key={n} onClick={()=>setPag(n)}
                      style={{ width:30, height:30, borderRadius:6, border:`1px solid ${n===pag?tab.color+"55":"rgba(255,255,255,0.08)"}`, background:n===pag?`${tab.color}18`:"transparent", color:n===pag?tab.color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:12, fontWeight:n===pag?700:400 }}>{n}</button>
                  ))}
                  {totalPags > 7 && <span style={{ color:"rgba(255,255,255,0.3)", fontSize:12, lineHeight:"30px" }}>… {totalPags}</span>}
                  <button onClick={()=>setPag(p=>Math.min(totalPags,p+1))} disabled={pag===totalPags}
                    style={{ width:30, height:30, borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:pag===totalPags?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.6)", cursor:pag===totalPags?"default":"pointer", fontSize:14 }}>›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
