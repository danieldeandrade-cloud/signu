"use client";
import Sidebar from "@/components/Sidebar";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { exportarListaParaExcel, exportarTodasAsListasParaExcel } from "@/lib/exportarExcel";

// Exportação HTML formatada para o relatório RENAJUD (abre no Excel com colunas e cores)
function exportarRelatorioRenajudHTML(linhas, nomeArquivo) {
  if (!linhas.length) return;
  const cols = Object.keys(linhas[0]);
  const labels = {
    Lista:"Lista", ID:"ID", ID_PASEI:"Processo (ID_PASEI)", Tipo:"Tipo", NIV:"NIV / Chassi",
    Status:"Status", Responsável:"Responsável", Total_Restrições:"Total Restrições",
    Pendentes:"Pendentes", Baixadas:"Baixadas", Situação:"Situação", Detalhes:"Detalhes",
  };
  const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const header = cols.map(c => `<th>${esc(labels[c]||c)}</th>`).join("");
  const rows = linhas.map(r => {
    const rowBg = String(r.Situação||"").includes("pendência") ? "#fff7ed" : "#f0fdf4";
    const cells = cols.map(c => {
      const v = r[c] ?? "";
      let style = "border:1px solid #d1d5db;padding:5px 10px;font-size:10pt;";
      if (c === "Pendentes") style += Number(v)>0 ? "color:#b45309;font-weight:bold;" : "color:#6b7280;";
      else if (c === "Baixadas") style += Number(v)>0 ? "color:#15803d;font-weight:bold;" : "color:#6b7280;";
      else if (c === "Situação") style += String(v).includes("pendência")
        ? "background:#fef3c7;color:#92400e;font-weight:bold;"
        : "background:#dcfce7;color:#166534;font-weight:bold;";
      else if (c === "Detalhes") style += "font-size:9pt;color:#374151;max-width:400px;";
      return `<td style="${style}">${esc(v)}</td>`;
    }).join("");
    return `<tr style="background:${rowBg}">${cells}</tr>`;
  }).join("");

  const gerado = new Date().toLocaleString("pt-BR");
  const totalPend = linhas.filter(r=>Number(r.Pendentes)>0).length;
  const totalBaix = linhas.filter(r=>Number(r.Pendentes)===0).length;

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>RENAJUD</x:Name></x:ExcelWorksheet>
</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<p style="font-family:Calibri;font-size:14pt;font-weight:bold;color:#1e2d3d;margin-bottom:2px">
  🔒 Relatório de Restrições RENAJUD — SIGNU</p>
<p style="font-family:Calibri;font-size:9pt;color:#6b7280;margin-bottom:12px">
  Gerado em ${gerado} &nbsp;|&nbsp; Total: ${linhas.length} bens &nbsp;|&nbsp;
  ⚠ Com pendência: ${totalPend} &nbsp;|&nbsp; ✓ Todas baixadas: ${totalBaix}</p>
<table style="border-collapse:collapse;font-family:Calibri,Arial;font-size:10pt;width:100%">
  <thead>
    <tr style="background:#1e2d3d">
      ${header.replace(/<th>/g,'<th style="background:#1e2d3d;color:#fff;padding:7px 10px;border:1px solid #374151;font-size:10pt;white-space:nowrap">')}
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

  const blob = new Blob([html], { type:"application/vnd.ms-excel;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
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
  { key:"FIB",            label:"FIB",                  color:"#22c55e", bg:"rgba(34,197,94,0.15)"    },
  { key:"CEB_TEP_TIV",   label:"CEB/TEP/TIV",          color:"#60a5fa", bg:"rgba(96,165,250,0.15)"   },
  { key:"RESTRICAO_ROUBO",label:"🔒 Roubo/Furto",      color:"#f87171", bg:"rgba(248,113,113,0.15)"  },
  { key:"OFICIO_BAIXA",  label:"Ofício Baixa",          color:"#a78bfa", bg:"rgba(167,139,250,0.15)"  },
  { key:"INUTILIZADO",   label:"Inutilizado",           color:"#fbbf24", bg:"rgba(251,191,36,0.15)"   },
  { key:"RENAJUD_ANY",   label:"🔒 RENAJUD",            color:"#f59e0b", bg:"rgba(245,158,11,0.15)"   },
  { key:"RENAJUD_PEND",  label:"🔒 RENAJUD Pendente",  color:"#f87171", bg:"rgba(248,113,113,0.15)"  },
];

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

function hasFlag(item, key) {
  if (key === "RENAJUD_ANY")  return parseRenajuds(item?.RENAJUDS).length > 0;
  if (key === "RENAJUD_PEND") return parseRenajuds(item?.RENAJUDS).some(r => !r.baixado);
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
      color: muted ? "#4b5563" : "#0f172a",
      textAlign: right ? "center" : "left",
      borderBottom:"1px solid #f3f4f6",
      whiteSpace:"nowrap",
    }}>{children}</td>
  );
}

function Spinner({ color }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 0", gap:16 }}>
      <div style={{ width:36, height:36, border:`3px solid ${color}30`, borderTop:`3px solid ${color}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <span style={{ fontSize:12, color:"#6b7280" }}>Carregando dados da planilha…</span>
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
  const [busca, setBusca]             = useState("");
  const [filtroStatus, setFiltroStatus] = useState(new Set());
  const [filtroTipo,   setFiltroTipo]   = useState(new Set());
  const [filtroResp,   setFiltroResp]   = useState(new Set());
  const [filtroFlags, setFiltroFlags]   = useState(new Set());
  const [filtroSemFib, setFiltroSemFib] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [carregandoRenajud,   setCarregandoRenajud]   = useState(false);
  const [modalRenajud,        setModalRenajud]         = useState(false);
  const [renajudLinhas,       setRenajudLinhas]        = useState([]);
  const [filtroRenajudSit,    setFiltroRenajudSit]    = useState("todas"); // "todas"|"pendente"|"baixada"
  const [filtroRenajudResp,   setFiltroRenajudResp]   = useState(new Set()); // vazio = todos

  const abrirModalRenajud = async () => {
    setCarregandoRenajud(true);
    try {
      const listas = [
        { key:"CEGOC",         rota:"cegoc" },
        { key:"PCDF 1ª HIGEIA",rota:"pcdf1" },
        { key:"PCDF 2ª HIGEIA",rota:"pcdf2" },
        { key:"DPJ-GC99",      rota:"dpj"   },
      ];
      const resultados = await Promise.all(listas.map(async l => {
        try {
          const res  = await fetch(`/api/bens/${l.rota}`);
          const json = await res.json();
          return (json.dados || []).map(i => ({ ...i, _lista: l.key }));
        } catch { return []; }
      }));
      const todos     = resultados.flat();
      const comRenajud = todos.filter(i => parseRenajuds(i.RENAJUDS).length > 0);
      if (!comRenajud.length) { alert("Nenhum bem com restrição RENAJUD encontrado."); return; }
      const linhas = comRenajud.map(i => {
        const r         = parseRenajuds(i.RENAJUDS);
        const pendentes = r.filter(x => !x.baixado);
        const baixadas  = r.filter(x =>  x.baixado);
        const idDisplay = i.ID_LEGADO || `${i._lista.split(" ")[0]}-${String(i._rowNumber).padStart(4,"0")}`;
        return {
          Lista:            i._lista,
          ID:               idDisplay,
          ID_PASEI:         i.ID_PASEI || "",
          Tipo:             i.TIPO_BEM || "",
          NIV:              i.NIV || "",
          Status:           i.STATUS_DILIGENCIA || "",
          Responsável:      i.RESPONSAVEL || i.Responsavel || "",
          Total_Restrições: r.length,
          Pendentes:        pendentes.length,
          Baixadas:         baixadas.length,
          Situação:         pendentes.length > 0 ? "⚠ Com pendência" : "✓ Todas baixadas",
          Detalhes:         r.map(x => `${x.descricao}${x.baixado ? ` [BAIXADA em ${x.dataBaixa}]` : " [PENDENTE]"}`).join(" | "),
        };
      });
      setRenajudLinhas(linhas);
      setFiltroRenajudSit("todas");
      setFiltroRenajudResp(new Set());
      setModalRenajud(true);
    } finally {
      setCarregandoRenajud(false);
    }
  };

  const gerarExcelRenajud = () => {
    const filtradas = renajudLinhas.filter(l => {
      if (filtroRenajudSit === "pendente" && !String(l.Situação).includes("pendência")) return false;
      if (filtroRenajudSit === "baixada"  && !String(l.Situação).includes("baixadas"))  return false;
      if (filtroRenajudResp.size > 0 && !filtroRenajudResp.has(l.Responsável)) return false;
      return true;
    });
    if (!filtradas.length) { alert("Nenhum registro com esses filtros."); return; }
    const sufixo = [
      filtroRenajudSit !== "todas" ? (filtroRenajudSit === "pendente" ? "_Pendentes" : "_Baixadas") : "",
      filtroRenajudResp.size > 0 ? `_${[...filtroRenajudResp].join("-").replace(/\s/g,"")}`:"",
    ].join("");
    exportarRelatorioRenajudHTML(filtradas, `SIGNU_Relatorio_RENAJUD${sufixo}_${new Date().toISOString().slice(0,10)}`);
  };

  const toggleSet = (setter, val) =>
    setter(prev => { const n = new Set(prev); n.has(val) ? n.delete(val) : n.add(val); return n; });

  const totalFiltrosAtivos =
    filtroStatus.size + filtroTipo.size + filtroResp.size + filtroFlags.size +
    (filtroSemFib ? 1 : 0) + (busca.trim() ? 1 : 0);
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
    setFiltroStatus(new Set());
    setFiltroTipo(new Set());
    setFiltroResp(new Set());
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
    if (filtroStatus.size > 0) {
      res = res.filter(i => filtroStatus.has(getStatus(i, abaAtiva)));
    }
    if (filtroTipo.size > 0) {
      res = res.filter(i => filtroTipo.has(i.TIPO_BEM));
    }
    if (filtroResp.size > 0) {
      res = res.filter(i => filtroResp.has(i.RESPONSAVEL || i.Responsavel || ""));
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
  }, [dados, busca, filtroStatus, filtroTipo, filtroResp, filtroFlags, filtroSemFib, ordenacao, abaAtiva]);

  const totalPags = Math.ceil(filtrados.length / POR_PAGINA);
  const pagina = filtrados.slice((pag-1)*POR_PAGINA, pag*POR_PAGINA);

  const ordeBy = (campo) => {
    setOrdenacao(o => ({ campo, dir: o.campo===campo && o.dir==="desc" ? "asc" : "desc" }));
    setPag(1);
  };

  const ThSort = ({ campo, children }) => (
    <th onClick={() => ordeBy(campo)} style={{ padding:"10px 14px", fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, textAlign:"left", cursor:"pointer", whiteSpace:"nowrap", userSelect:"none", borderBottom:"1px solid #e5e7eb" }}>
      {children} {ordenacao.campo===campo ? (ordenacao.dir==="asc" ? "↑" : "↓") : <span style={{ opacity:0.3 }}>↕</span>}
    </th>
  );

  const statusOptions = [...new Set(dados.map(i => getStatus(i, abaAtiva)).filter(Boolean))].sort();
  const tipoOptions   = [...new Set(dados.map(i => i.TIPO_BEM).filter(Boolean))].sort();
  const respOptions   = [...new Set(dados.map(i => i.RESPONSAVEL || i.Responsavel || "").filter(Boolean))].sort();

  const limparFiltros = () => {
    setBusca(""); setFiltroStatus(new Set()); setFiltroTipo(new Set());
    setFiltroResp(new Set()); setFiltroFlags(new Set()); setFiltroSemFib(false); setPag(1);
  };

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
    <div className="signu-layout" style={{ background:"#dde1e7", fontFamily:"'Inter',system-ui,sans-serif", color:"#111827" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#9ca3af;border-radius:4px}
        tr:hover td{background:#f9fafb!important}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <Sidebar />

      <main className="signu-main">

        {/* Top bar */}
        <header style={{ height:56, borderBottom:"1px solid #e5e7eb", background:"#1e2d3d", display:"flex", alignItems:"center", padding:"0 24px", gap:12, flexShrink:0 }}>
          <span style={{ fontSize:13, color:"#4b5563" }}>SIGNU</span>
          <span style={{ color:"#d1d5db" }}>/</span>
          <span style={{ fontSize:13, fontWeight:700, color:"#fff" }}>Gestão</span>
          <span style={{ color:"#d1d5db" }}>/</span>
          <span style={{ fontSize:12, fontWeight:700, color:tab.color, background:tab.bg, padding:"2px 10px", borderRadius:4 }}>{tab.label}</span>
          <div style={{ flex:1 }}/>
          {loading ? (
            <span style={{ fontSize:11, color:"#6b7280", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:10, height:10, border:`2px solid ${tab.color}40`, borderTop:`2px solid ${tab.color}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
              Carregando…
            </span>
          ) : (
            <span style={{ fontSize:11, color:"#6b7280", fontFamily:"'IBM Plex Mono',monospace" }}>
              {filtrados.length} registro{filtrados.length!==1?"s":""}
            </span>
          )}
          <button
            onClick={() => exportarListaParaExcel(filtrados, `${tab.label}${filtroSemFib?"_SemFIB":""}`)}
            disabled={filtrados.length === 0}
            title="Exportar dados filtrados para Excel"
            style={{ padding:"5px 10px", background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:6, color:"#22c55e", fontSize:11, cursor:filtrados.length===0?"not-allowed":"pointer", fontWeight:600, opacity:filtrados.length===0?0.4:1 }}>
            ⬇ Excel
          </button>
          <button
            onClick={abrirModalRenajud}
            disabled={carregandoRenajud}
            title="Relatório de restrições RENAJUD de todas as listas"
            style={{ padding:"5px 10px", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:6, color:"#f59e0b", fontSize:11, cursor:carregandoRenajud?"wait":"pointer", fontWeight:600, opacity:carregandoRenajud?0.6:1 }}>
            {carregandoRenajud ? "⏳ Carregando…" : "🔒 Rel. RENAJUD"}
          </button>
          <button onClick={() => fetchAba(abaAtiva)} title="Recarregar da planilha"
            style={{ padding:"5px 10px", background:"rgba(37,99,235,0.07)", border:"1.5px solid #b0b8c4", borderRadius:6, color:"#2563eb", fontSize:11, cursor:"pointer", fontWeight:600 }}>
            ↻ Atualizar
          </button>
        </header>

        {/* ABAS */}
        <div style={{ background:"#fff", borderBottom:"1px solid #d1d5db", padding:"0 24px", display:"flex", gap:0, flexShrink:0, overflowX:"auto" }}>
          {LISTAS_TABS.map(t => (
            <button key={t.key} onClick={() => setAbaAtiva(t.key)}
              style={{
                padding:"12px 18px", border:"none", background:"transparent", cursor:"pointer",
                fontSize:12, fontWeight:abaAtiva===t.key?700:400, whiteSpace:"nowrap",
                color:abaAtiva===t.key?t.color:"#4b5563",
                borderBottom:abaAtiva===t.key?`2px solid ${t.color}`:"2px solid transparent",
                transition:"all 0.15s", display:"flex", alignItems:"center", gap:6,
              }}>
              {t.icon} {t.label}
              <span style={{ fontSize:10, background:abaAtiva===t.key?t.bg:"#e5e7eb", color:abaAtiva===t.key?t.color:"#4b5563", padding:"1px 6px", borderRadius:10, fontWeight:700 }}>
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
              <div key={s.label} style={{ display:"flex", alignItems:"center", gap:8, background:"#f9fafb", border:"1.5px solid #b0b8c4", borderRadius:8, padding:"7px 14px" }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:s.color, flexShrink:0 }}/>
                <span style={{ fontSize:11, color:"#4b5563" }}>{s.label}</span>
                <span style={{ fontSize:14, fontWeight:800, color:"#0f172a" }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* ── Painel de filtros ── */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom: filtrosAbertos ? 10 : 0 }}>
              {/* Busca */}
              <div style={{ position:"relative", flex:1, minWidth:180 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }}>
                  <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
                </svg>
                <input value={busca} onChange={e=>{setBusca(e.target.value);setPag(1);}}
                  placeholder="Buscar por PA, NIV, responsável, tipo…"
                  style={{ width:"100%", padding:"7px 10px 7px 30px", background:"#f3f4f6", border:"1.5px solid #b0b8c4", borderRadius:8, color:"#0f172a", fontSize:12, outline:"none", boxSizing:"border-box" }}/>
              </div>
              {/* Botão expandir */}
              <button onClick={()=>setFiltrosAbertos(o=>!o)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", background: filtrosAbertos || totalFiltrosAtivos>0 ? "rgba(37,99,235,0.1)" : "#f3f4f6", border:`1px solid ${filtrosAbertos || totalFiltrosAtivos>0 ? "rgba(37,99,235,0.4)" : "#e5e7eb"}`, borderRadius:8, color: filtrosAbertos || totalFiltrosAtivos>0 ? "#2563eb" : "#374151", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                Filtros
                {totalFiltrosAtivos > 0 && (
                  <span style={{ background:"#2563eb", color:"#fff", borderRadius:10, padding:"0 6px", fontSize:10, fontWeight:800 }}>{totalFiltrosAtivos}</span>
                )}
              </button>
              <span style={{ fontSize:11, color:"#6b7280" }}>
                {filtrados.length} de {dados.length} registro{dados.length !== 1 ? "s" : ""}
              </span>
              {totalFiltrosAtivos > 0 && (
                <button onClick={limparFiltros} style={{ fontSize:11, color:"#4b5563", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>Limpar filtros</button>
              )}
            </div>

            {/* Painel expansível */}
            {filtrosAbertos && (
              <div style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:12 }}>

                {/* Status */}
                {statusOptions.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:7 }}>Status</div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {statusOptions.map(s => {
                        const ativo = filtroStatus.has(s);
                        const cor = s==="ATRASADO"?"#f87171":s==="PRAZO 6 MESES"?"#fbbf24":s==="EM DILIGÊNCIA"?"#22c55e":s==="AGUARDANDO"?"#60a5fa":"#374151";
                        const count = dados.filter(i => getStatus(i, abaAtiva) === s).length;
                        return (
                          <button key={s} onClick={()=>{toggleSet(setFiltroStatus,s);setPag(1);}}
                            style={{ padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:ativo?700:400, cursor:"pointer", border:`1px solid ${ativo?cor:"#d1d5db"}`, background:ativo?`${cor}18`:"transparent", color:ativo?cor:"#374151", transition:"all 0.15s", display:"flex", alignItems:"center", gap:5 }}>
                            {ativo&&"✓ "}{s} <span style={{ fontSize:10, opacity:.5 }}>({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tipo de Bem */}
                {tipoOptions.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:7 }}>Tipo de Bem</div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {tipoOptions.map(t => {
                        const ativo = filtroTipo.has(t);
                        const icones = {CARRO:"🚗",MOTO:"🏍️",CAMINHONETE:"🛻",CAMINHÃO:"🚛",REBOQUE:"🚜",OUTROS:"📦"};
                        const count = dados.filter(i => i.TIPO_BEM === t).length;
                        return (
                          <button key={t} onClick={()=>{toggleSet(setFiltroTipo,t);setPag(1);}}
                            style={{ padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:ativo?700:400, cursor:"pointer", border:`1px solid ${ativo?"#2563eb":"#d1d5db"}`, background:ativo?"rgba(37,99,235,0.1)":"transparent", color:ativo?"#2563eb":"#374151", transition:"all 0.15s", display:"flex", alignItems:"center", gap:5 }}>
                            {icones[t]||"📦"} {ativo&&"✓ "}{t} <span style={{ fontSize:10, opacity:.5 }}>({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Responsável */}
                {respOptions.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:7 }}>Responsável</div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {respOptions.map(r => {
                        const ativo = filtroResp.has(r);
                        const count = dados.filter(i => (i.RESPONSAVEL||i.Responsavel||"") === r).length;
                        return (
                          <button key={r} onClick={()=>{toggleSet(setFiltroResp,r);setPag(1);}}
                            style={{ padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:ativo?700:400, cursor:"pointer", border:`1px solid ${ativo?"#a78bfa":"#d1d5db"}`, background:ativo?"rgba(167,139,250,0.12)":"transparent", color:ativo?"#a78bfa":"#374151", transition:"all 0.15s", display:"flex", alignItems:"center", gap:5 }}>
                            {ativo&&"✓ "}{r} <span style={{ fontSize:10, opacity:.5 }}>({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Flags */}
                {(flagsDisponiveis.length > 0 || abaAtiva==="CEGOC" || abaAtiva==="PCDF_1HIGEIA" || abaAtiva==="PCDF_2HIGEIA") && (
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:7 }}>🏷 Flags</div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {flagsDisponiveis.map(f => {
                        const ativo = filtroFlags.has(f.key);
                        const count = dados.filter(i => hasFlag(i, f.key)).length;
                        return (
                          <button key={f.key} onClick={()=>{toggleFlag(f.key);setPag(1);}}
                            style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:ativo?700:400, cursor:"pointer", transition:"all 0.15s", border:`1px solid ${ativo?f.color:"#d1d5db"}`, background:ativo?f.bg:"transparent", color:ativo?f.color:"#374151" }}>
                            {ativo&&"✓ "}{f.label} <span style={{ fontSize:10, opacity:.6 }}>({count})</span>
                          </button>
                        );
                      })}
                      {(abaAtiva==="CEGOC"||abaAtiva==="PCDF_1HIGEIA"||abaAtiva==="PCDF_2HIGEIA") && (
                        <button onClick={()=>{setFiltroSemFib(v=>!v);setPag(1);}}
                          style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:filtroSemFib?700:400, cursor:"pointer", transition:"all 0.15s", border:`1px solid ${filtroSemFib?"#f87171":"#d1d5db"}`, background:filtroSemFib?"rgba(248,113,113,0.15)":"transparent", color:filtroSemFib?"#f87171":"#374151" }}>
                          {filtroSemFib&&"✓ "}⚠️ Sem FIB <span style={{ fontSize:10, opacity:.6 }}>({dados.filter(i=>!hasFlag(i,"FIB")).length})</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chips ativos fora do painel */}
            {!filtrosAbertos && totalFiltrosAtivos > 0 && (
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:8 }}>
                {[...filtroStatus].map(s=>(
                  <span key={s} onClick={()=>{toggleSet(setFiltroStatus,s);setPag(1);}} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 9px", background:"rgba(37,99,235,0.08)", border:"1.5px solid #b0b8c4", borderRadius:20, fontSize:11, color:"#2563eb", cursor:"pointer" }}>{s} ✕</span>
                ))}
                {[...filtroTipo].map(t=>(
                  <span key={t} onClick={()=>{toggleSet(setFiltroTipo,t);setPag(1);}} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 9px", background:"#f3f4f6", border:"1px solid #d1d5db", borderRadius:20, fontSize:11, color:"#1f2937", cursor:"pointer" }}>{t} ✕</span>
                ))}
                {[...filtroResp].map(r=>(
                  <span key={r} onClick={()=>{toggleSet(setFiltroResp,r);setPag(1);}} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 9px", background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:20, fontSize:11, color:"#a78bfa", cursor:"pointer" }}>{r} ✕</span>
                ))}
                {[...filtroFlags].map(f=>{const meta=FLAGS_CONFIG.find(x=>x.key===f);return(
                  <span key={f} onClick={()=>{toggleFlag(f);setPag(1);}} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 9px", background:meta?.bg||"#f3f4f6", border:`1px solid ${meta?.color||"#d1d5db"}`, borderRadius:20, fontSize:11, color:meta?.color||"#1f2937", cursor:"pointer" }}>{meta?.label||f} ✕</span>
                );})}
                {filtroSemFib && (
                  <span onClick={()=>{setFiltroSemFib(false);setPag(1);}} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 9px", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:20, fontSize:11, color:"#f87171", cursor:"pointer" }}>Sem FIB ✕</span>
                )}
              </div>
            )}
          </div>

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
          <div style={{ background:"#fff", border:"1.5px solid #b0b8c4", borderRadius:12, overflow:"hidden" }}>
            {loading ? (
              <Spinner color={tab.color}/>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#f9fafb" }}>
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
                      <th style={{ padding:"10px 14px", fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, borderBottom:"1px solid #e5e7eb" }}>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagina.length === 0 ? (
                      <tr><td colSpan={12} style={{ padding:"48px", textAlign:"center", color:"#9ca3af", fontSize:13, fontStyle:"italic" }}>Nenhum registro encontrado.</td></tr>
                    ) : pagina.map((item, ri) => {
                      const status = getStatus(item, abaAtiva);
                      const idDisplay = displayId(item, abaAtiva);
                      const prazoVencido = item.PRAZO_6MESES && new Date(item.PRAZO_6MESES) <= new Date();
                      return (
                        <tr key={item._rowNumber}
                          onClick={() => router.push(`/detalhes?lista=${LISTA_API_MAP[abaAtiva]}&row=${item._rowNumber}`)}
                          style={{ cursor:"pointer", background: ri%2===0?"transparent":"#fafafa" }}>
                          <Cell mono><span style={{ color:tab.color, fontWeight:700 }}>{idDisplay}</span></Cell>
                          <Cell mono muted>{item.ID_PASEI ? item.ID_PASEI.substring(0,22)+"…" : "—"}</Cell>
                          <Cell>{TIPO_ICON[item.TIPO_BEM] || "📦"} {item.TIPO_BEM || "—"}</Cell>
                          <Cell mono muted>{item.NIV || "—"}</Cell>
                          {abaAtiva==="DPJ_GC99"      && <Cell right>{item.LOTE ? `#${item.LOTE}` : "—"}</Cell>}
                          {abaAtiva==="DPJ_GC99"      && <Cell mono><span style={{ color: prazoVencido ? "#f87171" : "#111827" }}>{item.PRAZO_6MESES || "—"}</span></Cell>}
                          {(abaAtiva==="PCDF_1HIGEIA"||abaAtiva==="PCDF_2HIGEIA") && <Cell muted>{item.DEPOSITO || "—"}</Cell>}
                          {abaAtiva==="PCDF_2HIGEIA"  && <Cell right>{item.RESTRICAO_ROUBO === "TRUE" || item.RESTRICAO_ROUBO === true ? "🔒 Sim" : "—"}</Cell>}
                          {abaAtiva==="DOACOES"        && <Cell muted>{(item.ENTIDADE_NOME || item.ENTIDADE) ? (item.ENTIDADE_NOME || item.ENTIDADE).substring(0,30)+"…" : "—"}</Cell>}
                          {abaAtiva==="CEGOC"          && <Cell muted>{item.DESTINACAO || "—"}</Cell>}
                          <td style={{ padding:"11px 14px", borderBottom:"1px solid #f3f4f6" }}>
                            <StatusBadge status={status}/>
                          </td>
                          <Cell muted>{(item.RESPONSAVEL || item.Responsavel || "").split(" ")[0] || "—"}</Cell>
                          <td style={{ padding:"11px 14px", fontSize:11, color:"#4b5563", borderBottom:"1px solid #f3f4f6", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={item.OBSERVACOES || ""}>
                            {item.OBSERVACOES ? item.OBSERVACOES.substring(0,40)+(item.OBSERVACOES.length>40?"…":"") : "—"}
                          </td>
                          <td style={{ padding:"11px 14px", borderBottom:"1px solid #f3f4f6" }}>
                            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                              {(item.FIB === "TRUE" || item.FIB === true || item.FIB === "Sim") &&
                                <span style={{ fontSize:9, background:"rgba(34,197,94,0.15)", color:"#22c55e", padding:"2px 5px", borderRadius:4, fontWeight:700 }}>FIB</span>}
                              {(item.CEB_TEP_TIV === "TRUE" || item.CEB_TEP_TIV === true) &&
                                <span style={{ fontSize:9, background:"rgba(96,165,250,0.15)", color:"#60a5fa", padding:"2px 5px", borderRadius:4, fontWeight:700 }}>CEB</span>}
                              {(item.RESTRICAO_ROUBO === "TRUE" || item.RESTRICAO_ROUBO === true) &&
                                <span style={{ fontSize:9, background:"rgba(248,113,113,0.15)", color:"#f87171", padding:"2px 5px", borderRadius:4, fontWeight:700 }}>🔒 Roubo</span>}
                              {(() => {
                                const r = renajudInfo(item);
                                if (!r) return null;
                                return r.pendentes > 0
                                  ? <span style={{ fontSize:9, background:"rgba(245,158,11,0.15)", color:"#f59e0b", padding:"2px 5px", borderRadius:4, fontWeight:700, whiteSpace:"nowrap" }}>🔒 {r.pendentes}p/{r.baixadas}b</span>
                                  : <span style={{ fontSize:9, background:"rgba(34,197,94,0.15)", color:"#22c55e", padding:"2px 5px", borderRadius:4, fontWeight:700, whiteSpace:"nowrap" }}>🔒 ✓ baix.</span>;
                              })()}
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
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderTop:"1px solid #e5e7eb" }}>
                <span style={{ fontSize:11, color:"#6b7280" }}>
                  {(pag-1)*POR_PAGINA+1}–{Math.min(pag*POR_PAGINA, filtrados.length)} de {filtrados.length}
                </span>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>setPag(p=>Math.max(1,p-1))} disabled={pag===1}
                    style={{ width:30, height:30, borderRadius:6, border:"1.5px solid #b0b8c4", background:"transparent", color:pag===1?"#9ca3af":"#1f2937", cursor:pag===1?"default":"pointer", fontSize:14 }}>‹</button>
                  {Array.from({length:Math.min(totalPags,7)},(_,i)=>i+1).map(n=>(
                    <button key={n} onClick={()=>setPag(n)}
                      style={{ width:30, height:30, borderRadius:6, border:`1px solid ${n===pag?tab.color+"55":"#e5e7eb"}`, background:n===pag?`${tab.color}18`:"transparent", color:n===pag?tab.color:"#4b5563", cursor:"pointer", fontSize:12, fontWeight:n===pag?700:400 }}>{n}</button>
                  ))}
                  {totalPags > 7 && <span style={{ color:"#6b7280", fontSize:12, lineHeight:"30px" }}>… {totalPags}</span>}
                  <button onClick={()=>setPag(p=>Math.min(totalPags,p+1))} disabled={pag===totalPags}
                    style={{ width:30, height:30, borderRadius:6, border:"1.5px solid #b0b8c4", background:"transparent", color:pag===totalPags?"#9ca3af":"#1f2937", cursor:pag===totalPags?"default":"pointer", fontSize:14 }}>›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Modal Relatório RENAJUD ── */}
      {modalRenajud && (() => {
        const servidores = [...new Set(renajudLinhas.map(l => l.Responsável).filter(Boolean))].sort();
        const filtradas  = renajudLinhas.filter(l => {
          if (filtroRenajudSit === "pendente" && !String(l.Situação).includes("pendência")) return false;
          if (filtroRenajudSit === "baixada"  && !String(l.Situação).includes("baixadas"))  return false;
          if (filtroRenajudResp.size > 0 && !filtroRenajudResp.has(l.Responsável)) return false;
          return true;
        });
        const toggleResp = r => setFiltroRenajudResp(prev => {
          const n = new Set(prev); n.has(r) ? n.delete(r) : n.add(r); return n;
        });
        return (
          <div onClick={()=>setModalRenajud(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div onClick={e=>e.stopPropagation()}
              className="signu-modal"
              style={{ background:"#fff", borderRadius:14, width:520, maxWidth:"95vw", maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,0.25)", overflow:"hidden" }}>

              {/* Header */}
              <div style={{ background:"#1e2d3d", padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>🔒 Relatório RENAJUD</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:2 }}>{renajudLinhas.length} bens com restrição encontrados</div>
                </div>
                <button onClick={()=>setModalRenajud(false)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.5)", fontSize:18, cursor:"pointer", lineHeight:1 }}>✕</button>
              </div>

              {/* Body */}
              <div style={{ padding:"20px", overflowY:"auto", flex:1, display:"flex", flexDirection:"column", gap:20 }}>

                {/* Filtro situação */}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Situação das restrições</div>
                  <div style={{ display:"flex", gap:8 }}>
                    {[
                      { v:"todas",    label:"Todas",           cor:"#6b7280" },
                      { v:"pendente", label:"⚠ Com pendência", cor:"#f59e0b" },
                      { v:"baixada",  label:"✓ Todas baixadas", cor:"#22c55e" },
                    ].map(({ v, label, cor }) => {
                      const ativo = filtroRenajudSit === v;
                      return (
                        <button key={v} onClick={() => setFiltroRenajudSit(v)}
                          style={{ padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:ativo?700:500, cursor:"pointer",
                            border:`1.5px solid ${ativo ? cor : "#d1d5db"}`,
                            background: ativo ? `${cor}18` : "transparent",
                            color: ativo ? cor : "#6b7280",
                            transition:"all 0.15s" }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filtro responsável */}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
                    Responsável
                    {filtroRenajudResp.size > 0 && (
                      <button onClick={() => setFiltroRenajudResp(new Set())}
                        style={{ marginLeft:10, fontSize:10, color:"#2563eb", background:"none", border:"none", cursor:"pointer", fontWeight:600, textTransform:"none" }}>
                        Limpar seleção
                      </button>
                    )}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:200, overflowY:"auto", padding:"2px 0" }}>
                    {servidores.map(s => {
                      const ativo   = filtroRenajudResp.has(s);
                      const contPend= renajudLinhas.filter(l => l.Responsável===s && String(l.Situação).includes("pendência")).length;
                      const contBaix= renajudLinhas.filter(l => l.Responsável===s && String(l.Situação).includes("baixadas")).length;
                      return (
                        <label key={s} onClick={() => toggleResp(s)}
                          style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, cursor:"pointer",
                            background: ativo ? "rgba(37,99,235,0.06)" : "#f9fafb",
                            border: `1.5px solid ${ativo ? "#2563eb" : "#e5e7eb"}`,
                            transition:"all 0.12s" }}>
                          <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${ativo?"#2563eb":"#9ca3af"}`,
                            background: ativo ? "#2563eb" : "transparent", flexShrink:0,
                            display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:11, fontWeight:700 }}>
                            {ativo ? "✓" : ""}
                          </div>
                          <span style={{ flex:1, fontSize:13, fontWeight:ativo?600:400, color:"#111827" }}>{s || "Sem responsável"}</span>
                          <div style={{ display:"flex", gap:6 }}>
                            {contPend > 0 && <span style={{ fontSize:10, color:"#f59e0b", background:"rgba(245,158,11,0.1)", padding:"1px 6px", borderRadius:10, fontWeight:700 }}>⚠ {contPend}</span>}
                            {contBaix > 0 && <span style={{ fontSize:10, color:"#22c55e", background:"rgba(34,197,94,0.1)", padding:"1px 6px", borderRadius:10, fontWeight:700 }}>✓ {contBaix}</span>}
                          </div>
                        </label>
                      );
                    })}
                    {servidores.length === 0 && (
                      <span style={{ fontSize:12, color:"#9ca3af" }}>Nenhum responsável identificado nos dados.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding:"14px 20px", borderTop:"1px solid #e5e7eb", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#f9fafb" }}>
                <span style={{ fontSize:12, color:"#6b7280" }}>
                  <span style={{ fontWeight:700, color:"#111827" }}>{filtradas.length}</span> registro{filtradas.length!==1?"s":""} selecionado{filtradas.length!==1?"s":""}
                </span>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>setModalRenajud(false)}
                    style={{ padding:"7px 14px", borderRadius:8, border:"1.5px solid #d1d5db", background:"transparent", color:"#374151", fontSize:12, cursor:"pointer" }}>
                    Cancelar
                  </button>
                  <button onClick={gerarExcelRenajud} disabled={filtradas.length===0}
                    style={{ padding:"7px 16px", borderRadius:8, border:"none", background: filtradas.length===0?"#e5e7eb":"#1e2d3d", color: filtradas.length===0?"#9ca3af":"#fff", fontSize:12, fontWeight:700, cursor:filtradas.length===0?"not-allowed":"pointer" }}>
                    ⬇ Gerar Excel ({filtradas.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
