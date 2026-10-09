"use client";
import Sidebar from "@/components/Sidebar";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// ─── CONFIG DAS LISTAS ────────────────────────────────────────────────────────
const LISTAS_CONFIG = [
  { key:"CEGOC",        rota:"cegoc",             label:"CEGOC",    icon:"🏛️", color:"#3b82f6", bg:"#1e3a5f", statusField:"STATUS_DILIGENCIA" },
  { key:"PCDF_1HIGEIA", rota:"pcdf1",             label:"PCDF 1ª", icon:"🚔", color:"#a78bfa", bg:"#3b1f5f", statusField:"STATUS_DILIGENCIA" },
  { key:"PCDF_2HIGEIA", rota:"pcdf2",             label:"PCDF 2ª", icon:"🚔", color:"#c084fc", bg:"#4a1f6f", statusField:"STATUS_DILIGENCIA" },
  { key:"DPJ_GC99",     rota:"dpj",               label:"DPJ-GC99",icon:"⚖️", color:"#fb923c", bg:"#5f2a0e", statusField:"STATUS_DILIGENCIA" },
  { key:"DOACOES",      rota:"doacoes_diligencia", label:"Doações", icon:"🤝", color:"#34d399", bg:"#064e3b", statusField:"STATUS_LOCAL_PA"   },
  { key:"CAIXA_SEI",    rota:"sei",               label:"Caixa SEI",icon:"📬",color:"#fbbf24", bg:"#451a03", statusField:"ACAO"             },
];

const TIPOS = ["CARRO","MOTO","CAMINHONETE","CAMINHÃO","REBOQUE","OUTROS"];
const TIPO_ICON = { CARRO:"🚗", MOTO:"🏍️", CAMINHONETE:"🛻", CAMINHÃO:"🚛", REBOQUE:"🚜", OUTROS:"📦" };
const TIPO_COLOR = { CARRO:"#3b82f6", MOTO:"#a78bfa", CAMINHONETE:"#34d399", CAMINHÃO:"#fb923c", REBOQUE:"#fbbf24", OUTROS:"#6b7280" };

// Mapeamento e-mail → nome do servidor no sistema
const MAPA_EMAIL_NOME = {
  "danieldeandrade@icloud.com":        null,
  "carlosalex1318@gmail.com":          null,
  "carcae@gmail.com":                  "Carlos Caetano",
  "amandalobojunqueira@gmail.com":     "Amanda Junqueira",
  "bsboqfazer@gmail.com":              "Letícia Mota",
  "carlaearaujo2@gmail.com":           "Carla Araújo",
  "marcelodefreitasoliveira@gmail.com":"Marcelo Oliveira",
  "joloara@gmail.com":                 "Loara Passo",
  "cacausantos@gmail.com":             "Cláudia Santos",
};
const GESTORES_GMAIL = ["danieldeandrade.pessoal@gmail.com","danieldeandrade@icloud.com","carlosalex1318@gmail.com"];
const SERVIDORES = ["Carla Araújo","Amanda Junqueira","Carlos Caetano","Cláudia Santos","Loara Passo","Letícia Mota","Marcelo Oliveira"];

function resolverNomeServidor(email, nomeGoogle) {
  if (!email && !nomeGoogle) return null;
  if (email && MAPA_EMAIL_NOME[email] !== undefined) return MAPA_EMAIL_NOME[email];
  return SERVIDORES.find(s => s.toLowerCase() === (nomeGoogle||"").toLowerCase()) || null;
}

// ─── REGRAS DOS INDICADORES ───────────────────────────────────────────────────
// Mesmas regras do relatório por e-mail (app/api/notificacoes/route.js):
// status encerrado fica fora dos indicadores operacionais; "parado" = ativo
// sem nenhuma mexida (ULTIMA_ANALISE → DATA_ATUALIZACAO → DATA_CADASTRO) há
// DIAS_PARADO dias ou mais.
const STATUS_ENCERRADO = ["RETIRADO","BAIXADO","CONCLUÍDO","CONCLUIDO","CANCELADO","ARQUIVADO","DOAÇÃO REALIZADA","VENDIDO E RETIRADO"];
const DIAS_PARADO = 21;
const ehEncerrado = (st) => STATUS_ENCERRADO.includes(String(st || "").toUpperCase().trim());
// DPJ-GC99 em "PRAZO 6 MESES" não conta como parado: o NULEJ só assume o item
// depois do marco de 6 meses da entrada (mesma regra do e-mail).
const podeFicarParado = (listaKey, st) =>
  !(listaKey === "DPJ_GC99" && String(st || "").toUpperCase().trim() === "PRAZO 6 MESES");
const LISTAS_BENS = ["CEGOC","PCDF_1HIGEIA","PCDF_2HIGEIA","DPJ_GC99","DOACOES"]; // Caixa SEI é processo, não bem
const PREFIXO = { CEGOC:"CEG", PCDF_1HIGEIA:"PCDF1", PCDF_2HIGEIA:"PCDF2", DPJ_GC99:"DPJ", DOACOES:"DOA", CAIXA_SEI:"SEI" };

function parseDataFlex(v) {
  if (!v) return 0;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  const d = new Date(s);
  return isNaN(d) ? 0 : d.getTime();
}
function diasSemMexida(item) {
  const t = parseDataFlex(item.ULTIMA_ANALISE) || parseDataFlex(item.DATA_ATUALIZACAO) || parseDataFlex(item.DATA_CADASTRO);
  return t ? Math.floor((Date.now() - t) / 86400000) : null;
}
// Tipos fora da lista do gráfico (ELETRÔNICO, MÓVEIS, vazio…) entram em OUTROS
function normTipo(t) {
  const x = String(t || "").toUpperCase().trim();
  if (x === "CAMIONETA") return "CAMINHONETE";
  return TIPOS.includes(x) ? x : "OUTROS";
}
const pesoKg = (r) => { const n = parseFloat(String(r.PESO_KG ?? "").replace(",", ".")); return isNaN(n) ? 0 : n; };
const fmtPeso = (kg) => kg >= 1000
  ? `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`
  : `${Math.round(kg).toLocaleString("pt-BR")} kg`;

// Automações que existem de verdade no SIGNU (crons em vercel.json + rotinas internas)
const AUTOMACOES = [
  { icon:"📧", nome:"Relatório por e-mail (gestores e servidores)", quando:"Dias úteis, 7h" },
  { icon:"📅", nome:"DPJ: fim do prazo de 6 meses → Em diligência", quando:"Dias úteis, 7h" },
  { icon:"🤝", nome:"Fila de doações: entidade prevista dos lotes", quando:"A cada alteração" },
  { icon:"📥", nome:"Importação SEI (leitura de processos + IA)",  quando:"Manual · revisão na Gestão" },
];

// ─── SUBCOMPONENTES ───────────────────────────────────────────────────────────
// Barra horizontal simples
function BarH({ value, max, color, height=8 }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ flex:1, height, background:"#e5e7eb", borderRadius:4, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:4, transition:"width 0.6s ease", minWidth: value > 0 ? 4 : 0 }}/>
    </div>
  );
}

// ─── GRÁFICO DE BARRAS AGRUPADO (SVG puro, sem lib) ──────────────────────────
function GraficoBarras({ filtroLista, tiposPorLista }) {
  const listas = filtroLista === "TODAS" ? Object.keys(tiposPorLista) : [filtroLista];
  const W = 520, H = 200, PADDING = { top:16, right:16, bottom:40, left:40 };
  const chartW = W - PADDING.left - PADDING.right;
  const chartH = H - PADDING.top - PADDING.bottom;

  // Agrupa por tipo
  const dados = TIPOS.map(tipo => ({
    tipo,
    total: listas.reduce((a, l) => a + (tiposPorLista[l]?.[tipo] || 0), 0),
  })).filter(d => d.total > 0);

  const maxVal = Math.max(...dados.map(d => d.total), 1);
  const barW = Math.min(48, (chartW / dados.length) - 10);
  const gap = (chartW - barW * dados.length) / (dados.length + 1);

  // Grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(p => Math.round(p * maxVal));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }}>
      {/* Grid */}
      {gridLines.map((v, i) => {
        const y = PADDING.top + chartH - (v / maxVal) * chartH;
        return (
          <g key={i}>
            <line x1={PADDING.left} y1={y} x2={PADDING.left + chartW} y2={y} stroke="#f3f4f6" strokeWidth="1"/>
            <text x={PADDING.left - 6} y={y + 4} fontSize="9" fill="#6b7280" textAnchor="end">{v}</text>
          </g>
        );
      })}
      {/* Barras */}
      {dados.map((d, i) => {
        const x = PADDING.left + gap * (i + 1) + barW * i;
        const barH2 = (d.total / maxVal) * chartH;
        const y = PADDING.top + chartH - barH2;
        const color = TIPO_COLOR[d.tipo] || "#6b7280";
        return (
          <g key={d.tipo}>
            {/* Barra com gradiente */}
            <defs>
              <linearGradient id={`grad-${d.tipo}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.9"/>
                <stop offset="100%" stopColor={color} stopOpacity="0.4"/>
              </linearGradient>
            </defs>
            <rect x={x} y={y} width={barW} height={barH2} rx="4" fill={`url(#grad-${d.tipo})`}/>
            {/* Valor no topo */}
            <text x={x + barW/2} y={y - 5} fontSize="10" fill="#0f172a" textAnchor="middle" fontWeight="600">{d.total}</text>
            {/* Label embaixo */}
            <text x={x + barW/2} y={PADDING.top + chartH + 14} fontSize="9" fill="#374151" textAnchor="middle">{d.tipo}</text>
            <text x={x + barW/2} y={PADDING.top + chartH + 25} fontSize="11" textAnchor="middle">{TIPO_ICON[d.tipo]}</text>
          </g>
        );
      })}
      {/* Eixo X */}
      <line x1={PADDING.left} y1={PADDING.top + chartH} x2={PADDING.left + chartW} y2={PADDING.top + chartH} stroke="#e5e7eb" strokeWidth="1"/>
    </svg>
  );
}

// ─── GRÁFICO ROSCA (SVG puro) ─────────────────────────────────────────────────
function GraficoRosca({ filtroLista, tiposPorLista }) {
  const listas = filtroLista === "TODAS" ? Object.keys(tiposPorLista) : [filtroLista];
  const dados = TIPOS.map(tipo => ({
    tipo,
    total: listas.reduce((a, l) => a + (tiposPorLista[l]?.[tipo] || 0), 0),
  })).filter(d => d.total > 0);

  const total = dados.reduce((a, d) => a + d.total, 0);
  const CX = 80, CY = 80, R = 65, r = 40;
  let startAngle = -Math.PI / 2;

  const slices = dados.map(d => {
    const angle = (d.total / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = CX + R * Math.cos(startAngle), y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(endAngle),   y2 = CY + R * Math.sin(endAngle);
    const ix1 = CX + r * Math.cos(startAngle), iy1 = CY + r * Math.sin(startAngle);
    const ix2 = CX + r * Math.cos(endAngle),   iy2 = CY + r * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${ix1} ${iy1} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z`;
    const slice = { ...d, path, pct: Math.round((d.total / total) * 100) };
    startAngle = endAngle;
    return slice;
  });

  return (
    <div style={{ display:"flex", alignItems:"center", gap:16 }}>
      <svg width="160" height="160" viewBox="0 0 160 160" style={{ flexShrink:0 }}>
        {slices.map(s => (
          <path key={s.tipo} d={s.path} fill={TIPO_COLOR[s.tipo] || "#6b7280"} opacity="0.85"/>
        ))}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#0f172a">{total}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9" fill="#4b5563">TOTAL</text>
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {slices.map(s => (
          <div key={s.tipo} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:2, background:TIPO_COLOR[s.tipo], flexShrink:0 }}/>
            <span style={{ fontSize:11, color:"#1f2937", flex:1 }}>{TIPO_ICON[s.tipo]} {s.tipo}</span>
            <span style={{ fontSize:11, fontWeight:700, color:"#0f172a" }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TABELA DE TIPOS ──────────────────────────────────────────────────────────
function TabelaTipos({ filtroLista, tiposPorLista, LISTAS }) {
  const listas = filtroLista === "TODAS"
    ? Object.entries(tiposPorLista)
    : [[filtroLista, tiposPorLista[filtroLista] || {}]];

  const maxTotal = Math.max(...TIPOS.map(t => listas.reduce((a, [, d]) => a + (d[t]||0), 0)), 1);

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr>
            <th style={{ textAlign:"left", padding:"8px 12px", color:"#6b7280", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, borderBottom:"1px solid #e5e7eb" }}>Tipo</th>
            {listas.map(([key]) => {
              const meta = LISTAS.find(l => l.key === key);
              return (
                <th key={key} style={{ textAlign:"center", padding:"8px 12px", color: meta?.color || "#fff", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, borderBottom:"1px solid #e5e7eb" }}>
                  {meta?.label || key}
                </th>
              );
            })}
            <th style={{ textAlign:"center", padding:"8px 12px", color:"#2563eb", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, borderBottom:"1px solid #e5e7eb" }}>TOTAL</th>
            <th style={{ padding:"8px 12px", borderBottom:"1px solid #e5e7eb", width:120 }}/>
          </tr>
        </thead>
        <tbody>
          {TIPOS.map((tipo, ri) => {
            const rowTotal = listas.reduce((a, [, d]) => a + (d[tipo]||0), 0);
            if (rowTotal === 0) return null;
            return (
              <tr key={tipo} style={{ background: ri % 2 === 0 ? "#f9fafb" : "transparent" }}>
                <td style={{ padding:"10px 12px", color:"#0f172a", fontWeight:600 }}>
                  <span style={{ marginRight:6 }}>{TIPO_ICON[tipo]}</span>{tipo}
                </td>
                {listas.map(([key, d]) => (
                  <td key={key} style={{ textAlign:"center", padding:"10px 12px", color:"#1f2937", fontFamily:"'IBM Plex Mono',monospace" }}>
                    {d[tipo] || 0}
                  </td>
                ))}
                <td style={{ textAlign:"center", padding:"10px 12px", color:"#0f172a", fontWeight:800, fontFamily:"'IBM Plex Mono',monospace" }}>
                  {rowTotal}
                </td>
                <td style={{ padding:"10px 12px" }}>
                  <BarH value={rowTotal} max={maxTotal} color={TIPO_COLOR[tipo]} height={6}/>
                </td>
              </tr>
            );
          })}
          {/* Totais */}
          <tr style={{ borderTop:"1px solid #e5e7eb" }}>
            <td style={{ padding:"10px 12px", color:"#1e40af", fontWeight:700, fontSize:11, textTransform:"uppercase" }}>TOTAL</td>
            {listas.map(([key]) => {
              const meta = LISTAS.find(l => l.key === key);
              return (
                <td key={key} style={{ textAlign:"center", padding:"10px 12px", color: meta?.color || "#fff", fontWeight:800, fontFamily:"'IBM Plex Mono',monospace" }}>
                  {Object.values(tiposPorLista[key] || {}).reduce((a,v)=>a+v,0)}
                </td>
              );
            })}
            <td style={{ textAlign:"center", padding:"10px 12px", color:"#2563eb", fontWeight:800, fontFamily:"'IBM Plex Mono',monospace" }}>
              {listas.reduce((a,[,d]) => a + Object.values(d).reduce((b,v)=>b+v,0), 0)}
            </td>
            <td/>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function InicioPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const primeiroNome = session?.user?.name?.split(" ")[0] || "";

  const saudacao = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();
  const [hoveredCard,    setHoveredCard]    = useState(null);
  const [filtroLista,    setFiltroLista]    = useState("TODAS");
  const [abaRelatorio,   setAbaRelatorio]   = useState("barras");
  const [dados,          setDados]          = useState(null);  // { [key]: rows[] } — null = carregando
  const [falhas,         setFalhas]         = useState([]);
  const [isGestor,       setIsGestor]       = useState(false);
  // filtroServidor: null = todos (visão gestores), string = nome do servidor
  const [filtroServidor, setFiltroServidor] = useState(undefined); // undefined = ainda resolvendo
  const [sessionResolvida, setSessionResolvida] = useState(false);

  // 1. Resolve identidade do usuário logado
  useEffect(() => {
    if (!session?.user) return;
    const email      = session.user.email || "";
    const nomeGoogle = session.user.name  || "";
    const gestor     = GESTORES_GMAIL.includes(email);
    setIsGestor(gestor);
    setFiltroServidor(gestor ? null : resolverNomeServidor(email, nomeGoogle)); // gestor vê tudo; servidor, só o dele
    setSessionResolvida(true);
  }, [session]);

  // 2. Busca as listas sempre que o filtro de servidor muda
  const reqRef = useRef(0);
  useEffect(() => {
    if (!sessionResolvida) return;
    const req = ++reqRef.current;
    const qs = filtroServidor ? `?atribuidoA=${encodeURIComponent(filtroServidor)}` : "";
    setDados(null);
    Promise.allSettled(LISTAS_CONFIG.map(async (cfg) => {
      const res = await fetch(`/api/bens/${cfg.rota}${qs}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.erro || `HTTP ${res.status}`);
      return json.dados || [];
    })).then(rs => {
      if (req !== reqRef.current) return; // filtro trocou no meio
      const novo = {};
      rs.forEach((r, i) => { novo[LISTAS_CONFIG[i].key] = r.status === "fulfilled" ? r.value : []; });
      setFalhas(LISTAS_CONFIG.filter((_, i) => rs[i].status === "rejected").map(c => c.label));
      setDados(novo);
    });
  }, [filtroServidor, sessionResolvida]);

  // 3. Indicadores (todos calculados aqui, a partir das linhas reais)
  const ind = useMemo(() => {
    const porLista = LISTAS_CONFIG.map(cfg => {
      const rows = dados?.[cfg.key] || [];
      const status = (r) => String(r[cfg.statusField] || "").trim();
      const ativos = rows.filter(r => !ehEncerrado(status(r)));
      const parados = ativos.filter(r => podeFicarParado(cfg.key, status(r)) && (diasSemMexida(r) ?? 0) >= DIAS_PARADO);
      const porStatus = {};
      ativos.forEach(r => {
        const st = status(r) || (cfg.key === "DOACOES" && !String(r.RESPONSAVEL || "").trim() ? "AGUARDANDO INÍCIO" : "SEM STATUS");
        porStatus[st] = (porStatus[st] || 0) + 1;
      });
      const reciclagem = rows.filter(r => r.DESTINACAO === "RECICLAGEM" || cfg.key === "PCDF_1HIGEIA" || cfg.key === "PCDF_2HIGEIA");
      return {
        ...cfg,
        rows, ativos, parados,
        total: rows.length,
        encerrados: rows.length - ativos.length,
        statusTop: Object.entries(porStatus).sort((a, b) => b[1] - a[1]),
        pesoReciclagem: reciclagem.reduce((a, r) => a + pesoKg(r), 0),
        pesoBaixado: reciclagem.filter(r => ehEncerrado(status(r))).reduce((a, r) => a + pesoKg(r), 0),
        // Lotes de doação aguardando início ficam sem responsável de propósito
        semResponsavel: ativos.filter(r => !String(r.RESPONSAVEL || "").trim() && !(cfg.key === "DOACOES" && !status(r))).length,
        novos: ativos.filter(r => !r.VISTO_EM).length,
      };
    });
    const bens = porLista.filter(l => LISTAS_BENS.includes(l.key));
    const soma = (arr, k) => arr.reduce((a, l) => a + l[k], 0);
    const paradosTop = bens
      .flatMap(l => l.parados.map(r => ({ r, l, dias: diasSemMexida(r) })))
      .sort((a, b) => b.dias - a.dias);
    const tiposPorLista = {};
    bens.forEach(l => {
      const t = {};
      l.ativos.forEach(r => { const k = normTipo(r.TIPO_BEM); t[k] = (t[k] || 0) + 1; });
      tiposPorLista[l.key] = t;
    });
    return {
      porLista, bens, paradosTop, tiposPorLista,
      ativos: bens.reduce((a, l) => a + l.ativos.length, 0),
      total: soma(bens, "total"),
      encerrados: soma(bens, "encerrados"),
      parados: bens.reduce((a, l) => a + l.parados.length, 0),
      semResponsavel: soma(porLista, "semResponsavel"),
      novos: soma(porLista, "novos"),
      pesoReciclagem: soma(bens, "pesoReciclagem"),
      pesoBaixado: soma(bens, "pesoBaixado"),
      sei: porLista.find(l => l.key === "CAIXA_SEI"),
    };
  }, [dados]);

  const carregando = dados === null;
  const nomeCurto = filtroServidor ? filtroServidor.split(" ")[0] : "";
  const abrirItem = (l, r) => router.push(`/detalhes?lista=${l.rota}&row=${r._rowNumber}`);
  const idItem = (l, r) => r.ID || r.ID_LEGADO || `${PREFIXO[l.key]}-${String(r._rowNumber).padStart(4, "0")}`;

  const kpis = [
    { label:"Bens em andamento", value:ind.ativos.toLocaleString("pt-BR"), icon:"📦", color:"#2563eb",
      sub:`de ${ind.total.toLocaleString("pt-BR")} cadastrados · ${ind.encerrados.toLocaleString("pt-BR")} encerrados` },
    { label:`Parados há +${DIAS_PARADO} dias`, value:ind.parados.toLocaleString("pt-BR"), icon:"⏳", color:"#dc2626",
      sub:"sem atualização (fora DPJ em prazo de 6 meses)" },
    filtroServidor
      ? { label:"Novos para você", value:ind.novos.toLocaleString("pt-BR"), icon:"🆕", color:"#16a34a", sub:"atribuídos e ainda não abertos" }
      : { label:"Sem responsável", value:ind.semResponsavel.toLocaleString("pt-BR"), icon:"👤", color:"#d97706", sub:"itens ativos sem ninguém atribuído" },
    { label:"Peso — reciclagem", value:fmtPeso(ind.pesoReciclagem), icon:"♻️", color:"#7c3aed",
      sub:`${fmtPeso(ind.pesoBaixado)} já baixados` },
    { label:"Caixa SEI pendente", value:(ind.sei?.ativos.length || 0).toLocaleString("pt-BR"), icon:"📬", color:"#ca8a04",
      sub:"processos ainda não arquivados" },
  ];

  return (
    <div className="signu-layout" style={{ background:"#dde1e7", fontFamily:"'Inter',system-ui,sans-serif", color:"#111827" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');
      `}</style>

      <Sidebar />

      {/* MAIN */}
      <main className="signu-main">
        {/* Top bar */}
        <header style={{ height:56,borderBottom:"1px solid #e5e7eb",background:"#1e2d3d",display:"flex",alignItems:"center",padding:"0 28px",justifyContent:"space-between",flexShrink:0 }}>
          <div>
            <span style={{ fontSize:13,fontWeight:700,color:"#fff" }}>Início</span>
            <span style={{ fontSize:12,color:"#6b7280",marginLeft:8 }}>SIGNU · NULEJ · TJDFT</span>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ fontSize:11,color:"#9ca3af",fontFamily:"'IBM Plex Mono',monospace" }}>
              {new Date().toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"})}
            </div>
            {!carregando && ind.parados > 0 && (
              <div style={{ display:"flex",alignItems:"center",gap:5,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:20,padding:"4px 12px",fontSize:11,color:"#f87171",fontWeight:600 }}>
                ⏳ {ind.parados} parados há +{DIAS_PARADO} dias
              </div>
            )}
          </div>
        </header>

        <div className="signu-content">

          {/* Saudação */}
          <div style={{ marginBottom:24, display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
            <div>
              <h1 style={{ fontSize:20,fontWeight:700,color:"#0f172a",margin:0,letterSpacing:"-0.02em" }}>
                {primeiroNome ? `${saudacao}, ${primeiroNome} 👋` : `${saudacao} 👋`}
              </h1>
              <p style={{ fontSize:13,color:"#6b7280",margin:"4px 0 0" }}>
                {filtroServidor
                  ? <>Dashboard de <strong style={{ color:"#1e40af" }}>{filtroServidor}</strong></>
                  : isGestor
                    ? "Visão geral — todos os servidores"
                    : "Resumo operacional do NULEJ em tempo real."
                }
              </p>
            </div>
            {/* Seletor de servidor — apenas gestores */}
            {isGestor && (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"#fff", border:"1.5px solid #b0b8c4", borderRadius:10, padding:"8px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                <span style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em" }}>Ver dados de:</span>
                <select value={filtroServidor || ""} onChange={e => setFiltroServidor(e.target.value || null)}
                  style={{ background:"transparent", border:"none", color:"#2563eb", fontSize:13, fontWeight:700, cursor:"pointer", outline:"none" }}>
                  <option value="">Todos os servidores</option>
                  {SERVIDORES.map(s => <option key={s} value={s} style={{ background:"#fff", color:"#111827" }}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          {falhas.length > 0 && (
            <div style={{ marginBottom:16, padding:"8px 12px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, fontSize:12, color:"#b91c1c" }}>
              Não foi possível carregar: {falhas.join(", ")}. Os números abaixo estão incompletos — recarregue a página.
            </div>
          )}

          {/* KPI CARDS */}
          <div className="signu-grid-5" style={{ marginBottom:24 }}>
            {kpis.map(({ label,value,icon,color,sub }) => (
              <div key={label} style={{ background:"#fff",border:`1px solid ${color}22`,borderRadius:12,boxShadow:"0 2px 8px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04)",padding:"18px 20px",position:"relative",overflow:"hidden" }}>
                <div style={{ position:"absolute",top:0,right:0,width:60,height:60,borderRadius:"0 12px 0 60px",background:`${color}08` }}/>
                <div style={{ fontSize:22,marginBottom:8 }}>{icon}</div>
                <div style={{ fontSize:28,fontWeight:800,color:"#0f172a",lineHeight:1,marginBottom:4 }}>
                  {carregando ? <span style={{ fontSize:18,color:`${color}60` }}>…</span> : value}
                </div>
                <div style={{ fontSize:12,fontWeight:600,color,marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:11,color:"#6b7280" }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* GRID: LISTAS + LATERAL */}
          <div className="signu-grid-main" style={{ marginBottom:24 }}>
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14 }}>Listas Operacionais</div>
              <div className="signu-grid-2">
                {ind.porLista.map((lista) => {
                  const pctEncerrado = lista.total ? Math.round((lista.encerrados / lista.total) * 100) : 0;
                  return (
                    <div key={lista.key} onClick={() => router.push(`/gestao?aba=${lista.key}`)} onMouseEnter={()=>setHoveredCard(lista.key)} onMouseLeave={()=>setHoveredCard(null)} style={{ background:"#fff",border:`1px solid ${hoveredCard===lista.key?lista.color+"55":lista.color+"18"}`,borderRadius:12,boxShadow:"0 2px 8px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04)",padding:"16px 18px",cursor:"pointer",transition:"all 0.18s ease",transform:hoveredCard===lista.key?"translateY(-2px)":"none" }}>
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                          <span style={{ fontSize:18 }}>{lista.icon}</span>
                          <span style={{ fontSize:12,fontWeight:700,color:lista.color,background:lista.bg,padding:"2px 8px",borderRadius:4 }}>{lista.label}</span>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <span style={{ fontSize:22,fontWeight:800,color:"#0f172a" }}>
                            {carregando ? <span style={{ fontSize:14,color:`${lista.color}60` }}>…</span> : lista.ativos.length.toLocaleString("pt-BR")}
                          </span>
                          {!carregando && <div style={{ fontSize:10,color:"#6b7280" }}>ativos · {lista.total.toLocaleString("pt-BR")} no total</div>}
                        </div>
                      </div>
                      {/* Barra: parcela já encerrada da lista */}
                      <div title={`${pctEncerrado}% encerrados`} style={{ height:4,background:"#e5e7eb",borderRadius:4,marginBottom:10,overflow:"hidden" }}>
                        <div style={{ height:"100%",width:`${pctEncerrado}%`,background:lista.color,borderRadius:4 }}/>
                      </div>
                      {!carregando && (
                        <>
                          <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginBottom:8,minHeight:20 }}>
                            {lista.statusTop.slice(0, 3).map(([st, n]) => (
                              <span key={st} style={{ fontSize:10,padding:"2px 7px",borderRadius:10,background:"#f3f4f6",color:"#374151",whiteSpace:"nowrap" }}>
                                {st.toLowerCase()} <strong style={{ color:"#0f172a" }}>{n}</strong>
                              </span>
                            ))}
                            {lista.statusTop.length === 0 && <span style={{ fontSize:10,color:"#9ca3af" }}>nenhum item ativo</span>}
                          </div>
                          <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:"#6b7280" }}>
                            <span>{lista.encerrados.toLocaleString("pt-BR")} encerrados ({pctEncerrado}%)</span>
                            <span style={{ color: lista.parados.length ? "#dc2626" : "#6b7280", fontWeight: lista.parados.length ? 700 : 400 }}>
                              ⏳ {lista.parados.length} parados +{DIAS_PARADO}d
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lateral */}
            <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
              {/* Parados há mais tempo */}
              <div style={{ background:"#fff",border:"1.5px solid #b0b8c4",borderRadius:12,boxShadow:"0 2px 8px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04)",padding:"16px 18px" }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4 }}>
                  <div style={{ fontSize:11,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:"0.1em" }}>
                    Parados há mais tempo{nomeCurto ? ` — ${nomeCurto}` : ""}
                  </div>
                  <button onClick={() => router.push("/fila")} style={{ fontSize:11,color:"#2563eb",background:"none",border:"none",cursor:"pointer",fontWeight:600 }}>Minha Fila →</button>
                </div>
                <div style={{ fontSize:10,color:"#6b7280",marginBottom:12 }}>Itens ativos sem atualização há {DIAS_PARADO} dias ou mais</div>
                {carregando ? (
                  <div style={{ textAlign:"center",padding:"20px 0",color:"#6b7280",fontSize:12 }}>carregando…</div>
                ) : ind.paradosTop.length === 0 ? (
                  <div style={{ textAlign:"center",padding:"20px 0",color:"#16a34a",fontSize:12 }}>
                    <div style={{ fontSize:20,marginBottom:6 }}>✅</div>
                    Nenhum item parado
                  </div>
                ) : (
                  <>
                    {ind.paradosTop.slice(0, 6).map(({ r, l, dias }) => (
                      <div key={`${l.key}-${r._rowNumber}`} onClick={() => abrirItem(l, r)}
                        style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"#f9fafb",borderRadius:8,borderLeft:`3px solid ${l.color}`,marginBottom:6,cursor:"pointer" }}>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:"#374151",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                            {r.ID_PASEI || r.PA || idItem(l, r)}
                          </div>
                          <div style={{ fontSize:10,color:"#6b7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                            {l.label}{!filtroServidor ? ` · ${r.RESPONSAVEL || "sem responsável"}` : ""}
                          </div>
                        </div>
                        <div style={{ fontSize:11,fontWeight:700,color:"#dc2626",flexShrink:0 }}>{dias} dias</div>
                      </div>
                    ))}
                    {ind.paradosTop.length > 6 && (
                      <div style={{ fontSize:11,color:"#6b7280",textAlign:"center",marginTop:6 }}>
                        +{ind.paradosTop.length - 6} itens parados
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Automações reais do sistema */}
              <div style={{ background:"#fff",border:"1.5px solid #b0b8c4",borderRadius:12,boxShadow:"0 2px 8px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04)",padding:"16px 18px" }}>
                <div style={{ fontSize:11,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14 }}>Automações do SIGNU</div>
                {AUTOMACOES.map(f => (
                  <div key={f.nome} style={{ display:"flex",alignItems:"flex-start",gap:8,marginBottom:9 }}>
                    <span style={{ fontSize:13,lineHeight:1.2 }}>{f.icon}</span>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:11,color:"#1f2937" }}>{f.nome}</div>
                      <div style={{ fontSize:10,color:"#6b7280" }}>{f.quando}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══ RELATÓRIO DE TIPOS DE BENS ══ */}
          <div style={{ background:"#fff",border:"1.5px solid #b0b8c4",borderRadius:16,padding:"20px 24px" }}>
            {/* Header do relatório */}
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12 }}>
              <div>
                <div style={{ fontSize:14,fontWeight:700,color:"#0f172a",marginBottom:3 }}>📊 Distribuição por Tipo de Bem</div>
                <div style={{ fontSize:11,color:"#6b7280" }}>Bens em andamento (sem os encerrados), por lista. Tipos fora da lista entram em “Outros”.</div>
              </div>
              <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
                {/* Filtro por lista */}
                <select value={filtroLista} onChange={e=>setFiltroLista(e.target.value)} style={{ padding:"5px 10px",background:"#f3f4f6",border:"1.5px solid #b0b8c4",borderRadius:6,color:"#2563eb",fontSize:12,cursor:"pointer",outline:"none" }}>
                  <option value="TODAS">Todas as listas</option>
                  {ind.bens.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
                {/* Abas gráfico/tabela */}
                <div style={{ display:"flex",background:"#f3f4f6",borderRadius:8,padding:3,gap:2 }}>
                  {[["barras","📊 Barras"],["rosca","🍩 Pizza"],["tabela","📋 Tabela"]].map(([id,label]) => (
                    <button key={id} onClick={()=>setAbaRelatorio(id)} style={{ padding:"5px 12px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:abaRelatorio===id?"rgba(37,99,235,0.12)":"transparent",color:abaRelatorio===id?"#2563eb":"#4b5563",transition:"all 0.15s" }}>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Peso estimado (reciclagem) por lista */}
            {(() => {
              const alvo = filtroLista === "TODAS" ? ind.bens : ind.bens.filter(l => l.key === filtroLista);
              const comPeso = alvo.filter(l => l.pesoReciclagem > 0);
              if (comPeso.length === 0) return null;
              const total = comPeso.reduce((a, l) => a + l.pesoReciclagem, 0);
              return (
                <div style={{ display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:18,padding:"12px 14px",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10 }}>
                  <span style={{ fontSize:11,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:"0.06em" }}>♻️ Peso estimado — reciclagem</span>
                  {comPeso.map(l => (
                    <span key={l.key} style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,background:"#fff",border:`1px solid ${l.color}33`,borderRadius:8,padding:"4px 10px" }}>
                      <span style={{ width:6,height:6,borderRadius:"50%",background:l.color }}/>
                      <span style={{ color:"#4b5563" }}>{l.label}</span>
                      <strong style={{ color:"#0f172a" }}>{fmtPeso(l.pesoReciclagem)}</strong>
                    </span>
                  ))}
                  {comPeso.length > 1 && (
                    <span style={{ marginLeft:"auto",fontSize:12,color:"#4b5563" }}>Total&nbsp;<strong style={{ color:"#7c3aed" }}>{fmtPeso(total)}</strong></span>
                  )}
                </div>
              );
            })()}

            {carregando ? (
              <div style={{ textAlign:"center",padding:"30px 0",color:"#6b7280",fontSize:12 }}>carregando…</div>
            ) : (
              <>
                {abaRelatorio === "barras" && (
                  <div>
                    <GraficoBarras filtroLista={filtroLista} tiposPorLista={ind.tiposPorLista}/>
                    <div style={{ display:"flex",gap:12,marginTop:16,flexWrap:"wrap" }}>
                      {TIPOS.map(tipo => {
                        const chaves = filtroLista==="TODAS" ? Object.keys(ind.tiposPorLista) : [filtroLista];
                        const total = chaves.reduce((a,l)=>a+(ind.tiposPorLista[l]?.[tipo]||0),0);
                        if(!total) return null;
                        return (
                          <div key={tipo} style={{ display:"flex",alignItems:"center",gap:6,background:`${TIPO_COLOR[tipo]}12`,border:`1px solid ${TIPO_COLOR[tipo]}30`,borderRadius:8,padding:"6px 12px" }}>
                            <span>{TIPO_ICON[tipo]}</span>
                            <span style={{ fontSize:11,color:"#1f2937" }}>{tipo}</span>
                            <span style={{ fontSize:13,fontWeight:800,color:"#0f172a" }}>{total}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {abaRelatorio === "rosca" && (
                  <div style={{ display:"grid",gridTemplateColumns:"auto 1fr",gap:32,alignItems:"center" }}>
                    <GraficoRosca filtroLista={filtroLista} tiposPorLista={ind.tiposPorLista}/>
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10 }}>
                      {TIPOS.map(tipo => {
                        const chaves = filtroLista==="TODAS" ? Object.keys(ind.tiposPorLista) : [filtroLista];
                        const total = chaves.reduce((a,l)=>a+(ind.tiposPorLista[l]?.[tipo]||0),0);
                        if(!total) return null;
                        const color = TIPO_COLOR[tipo];
                        return (
                          <div key={tipo} style={{ background:`${color}10`,border:`1px solid ${color}25`,borderRadius:10,padding:"12px 14px",textAlign:"center" }}>
                            <div style={{ fontSize:22,marginBottom:4 }}>{TIPO_ICON[tipo]}</div>
                            <div style={{ fontSize:20,fontWeight:800,color:"#0f172a" }}>{total}</div>
                            <div style={{ fontSize:10,color,fontWeight:600,marginTop:2 }}>{tipo}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {abaRelatorio === "tabela" && (
                  <TabelaTipos filtroLista={filtroLista} tiposPorLista={ind.tiposPorLista} LISTAS={ind.bens}/>
                )}
              </>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
