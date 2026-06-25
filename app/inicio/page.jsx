"use client";
import Sidebar from "@/components/Sidebar";
import { useState, useEffect } from "react";
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

// Distribuição por TIPO DE BEM — preenchida via API
let TIPOS_POR_LISTA = {
  CEGOC:        {},
  PCDF_1HIGEIA: {},
  PCDF_2HIGEIA: {},
  DPJ_GC99:     {},
  DOACOES:      {},
  CAIXA_SEI:    {},
};

const TIPOS = ["CARRO","MOTO","CAMINHONETE","CAMINHÃO","REBOQUE","OUTROS"];
const TIPO_ICON = { CARRO:"🚗", MOTO:"🏍️", CAMINHONETE:"🛻", CAMINHÃO:"🚛", REBOQUE:"🚜", OUTROS:"📦" };
const TIPO_COLOR = { CARRO:"#3b82f6", MOTO:"#a78bfa", CAMINHONETE:"#34d399", CAMINHÃO:"#fb923c", REBOQUE:"#fbbf24", OUTROS:"#6b7280" };

// Preview da fila — mantido estático no dashboard (a tela "Minha Fila" tem os dados reais)
const MINHA_FILA_PREVIEW = [
  { id:"CEGOC-0142", tipo:"CARRO",       lista:"CEGOC",   status:"EM DILIGÊNCIA", dias:12, color:"#3b82f6" },
  { id:"CEGOC-0087", tipo:"MOTO",        lista:"CEGOC",   status:"ATRASADO",      dias:34, color:"#3b82f6" },
  { id:"PCDF1-0331", tipo:"CAMINHONETE", lista:"PCDF 1ª", status:"AGUARDANDO",    dias:5,  color:"#a78bfa" },
  { id:"DPJ-0049",   tipo:"CARRO",       lista:"DPJ-GC99",status:"PRAZO 6 MESES", dias:8,  color:"#fb923c" },
];

const FLOWS = [
  { nome:"Alertas Bens Atrasados",   ultimo:"Hoje 08:00",  icon:"⏰" },
  { nome:"Notificação Novo Bem",     ultimo:"Hoje 09:14",  icon:"🔔" },
  { nome:"Relatório Semanal",        ultimo:"Seg 07:30",   icon:"📊" },
  { nome:"Transição CEGOC→PCDF2",   ultimo:"Ontem 14:22", icon:"🔄" },
  { nome:"Transição CEGOC→Catálogo",ultimo:"Ontem 11:05", icon:"📋" },
  { nome:"DPJ Prazo 6 Meses",       ultimo:"Hoje 07:15",  icon:"📅" },
];

const STATUS_COLOR = {
  "EM DILIGÊNCIA":"#22c55e","AGUARDANDO":"#60a5fa","ATRASADO":"#f87171","PRAZO 6 MESES":"#fbbf24",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function totalTipo(tipo) {
  return Object.values(TIPOS_POR_LISTA).reduce((a, l) => a + (l[tipo] || 0), 0);
}
function tipoEmLista(tipo, listaKey) {
  return TIPOS_POR_LISTA[listaKey]?.[tipo] || 0;
}

// ─── SUBCOMPONENTES ───────────────────────────────────────────────────────────
function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:13, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
    </div>
  );
}

// Barra horizontal simples
function BarH({ value, max, color, height=8 }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ flex:1, height, background:"rgba(255,255,255,0.06)", borderRadius:4, overflow:"hidden" }}>
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
            <line x1={PADDING.left} y1={y} x2={PADDING.left + chartW} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            <text x={PADDING.left - 6} y={y + 4} fontSize="9" fill="rgba(255,255,255,0.25)" textAnchor="end">{v}</text>
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
            <text x={x + barW/2} y={y - 5} fontSize="10" fill="#fff" textAnchor="middle" fontWeight="600">{d.total}</text>
            {/* Label embaixo */}
            <text x={x + barW/2} y={PADDING.top + chartH + 14} fontSize="9" fill="rgba(255,255,255,0.45)" textAnchor="middle">{d.tipo}</text>
            <text x={x + barW/2} y={PADDING.top + chartH + 25} fontSize="11" textAnchor="middle">{TIPO_ICON[d.tipo]}</text>
          </g>
        );
      })}
      {/* Eixo X */}
      <line x1={PADDING.left} y1={PADDING.top + chartH} x2={PADDING.left + chartW} y2={PADDING.top + chartH} stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
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
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff">{total}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">TOTAL</text>
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {slices.map(s => (
          <div key={s.tipo} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:2, background:TIPO_COLOR[s.tipo], flexShrink:0 }}/>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.6)", flex:1 }}>{TIPO_ICON[s.tipo]} {s.tipo}</span>
            <span style={{ fontSize:11, fontWeight:700, color:"#fff" }}>{s.pct}%</span>
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
            <th style={{ textAlign:"left", padding:"8px 12px", color:"rgba(255,255,255,0.3)", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>Tipo</th>
            {listas.map(([key]) => {
              const meta = LISTAS.find(l => l.key === key);
              return (
                <th key={key} style={{ textAlign:"center", padding:"8px 12px", color: meta?.color || "#fff", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  {meta?.label || key}
                </th>
              );
            })}
            <th style={{ textAlign:"center", padding:"8px 12px", color:"#c9a84c", fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>TOTAL</th>
            <th style={{ padding:"8px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", width:120 }}/>
          </tr>
        </thead>
        <tbody>
          {TIPOS.map((tipo, ri) => {
            const rowTotal = listas.reduce((a, [, d]) => a + (d[tipo]||0), 0);
            if (rowTotal === 0) return null;
            return (
              <tr key={tipo} style={{ background: ri % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                <td style={{ padding:"10px 12px", color:"rgba(255,255,255,0.8)", fontWeight:600 }}>
                  <span style={{ marginRight:6 }}>{TIPO_ICON[tipo]}</span>{tipo}
                </td>
                {listas.map(([key, d]) => (
                  <td key={key} style={{ textAlign:"center", padding:"10px 12px", color:"rgba(255,255,255,0.6)", fontFamily:"'IBM Plex Mono',monospace" }}>
                    {d[tipo] || 0}
                  </td>
                ))}
                <td style={{ textAlign:"center", padding:"10px 12px", color:"#fff", fontWeight:800, fontFamily:"'IBM Plex Mono',monospace" }}>
                  {rowTotal}
                </td>
                <td style={{ padding:"10px 12px" }}>
                  <BarH value={rowTotal} max={maxTotal} color={TIPO_COLOR[tipo]} height={6}/>
                </td>
              </tr>
            );
          })}
          {/* Totais */}
          <tr style={{ borderTop:"1px solid rgba(255,255,255,0.08)" }}>
            <td style={{ padding:"10px 12px", color:"rgba(201,168,76,0.8)", fontWeight:700, fontSize:11, textTransform:"uppercase" }}>TOTAL</td>
            {listas.map(([key]) => {
              const meta = LISTAS.find(l => l.key === key);
              return (
                <td key={key} style={{ textAlign:"center", padding:"10px 12px", color: meta?.color || "#fff", fontWeight:800, fontFamily:"'IBM Plex Mono',monospace" }}>
                  {meta?.total || listas.find(([k])=>k===key)?.[1] ? Object.values(TIPOS_POR_LISTA[key]||{}).reduce((a,v)=>a+v,0) : 0}
                </td>
              );
            })}
            <td style={{ textAlign:"center", padding:"10px 12px", color:"#c9a84c", fontWeight:800, fontFamily:"'IBM Plex Mono',monospace" }}>
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
  const [hoveredCard, setHoveredCard] = useState(null);
  const [filtroLista, setFiltroLista] = useState("TODAS");
  const [abaRelatorio, setAbaRelatorio] = useState("barras");
  const [listas, setListas] = useState(
    LISTAS_CONFIG.map(c => ({ ...c, total:0, atrasados:0, em_diligencia:0, aguardando:0, carregando:true }))
  );
  const [tiposPorLista, setTiposPorLista] = useState(TIPOS_POR_LISTA);

  // Busca dados de todas as listas em paralelo
  useEffect(() => {
    LISTAS_CONFIG.forEach(async (cfg) => {
      try {
        const res = await fetch(`/api/bens/${cfg.rota}`);
        const json = await res.json();
        const dados = json.dados || [];

        // Contagens de status
        const total       = dados.length;
        const atrasados   = dados.filter(r => r[cfg.statusField] === "ATRASADO").length;
        const em_diligencia = dados.filter(r => r[cfg.statusField] === "EM DILIGÊNCIA").length;
        const aguardando  = dados.filter(r => r[cfg.statusField] === "AGUARDANDO").length;

        // Distribuição por tipo
        const tipos = {};
        dados.forEach(r => {
          const tipo = r.TIPO_BEM || "OUTROS";
          tipos[tipo] = (tipos[tipo] || 0) + 1;
        });

        setListas(prev => prev.map(l => l.key === cfg.key
          ? { ...l, total, atrasados, em_diligencia, aguardando, carregando:false }
          : l
        ));
        setTiposPorLista(prev => ({ ...prev, [cfg.key]: tipos }));
      } catch {
        setListas(prev => prev.map(l => l.key === cfg.key ? { ...l, carregando:false } : l));
      }
    });
  }, []);

  // Usa listas carregadas no lugar do array estático
  const LISTAS = listas;

  const totalGeral = LISTAS.reduce((a, l) => a + l.total, 0);
  const totalAtrasados = LISTAS.reduce((a, l) => a + l.atrasados, 0);
  const totalEmDiligencia = LISTAS.reduce((a, l) => a + l.em_diligencia, 0);
  const taxaExecucao = totalGeral > 0 ? Math.round((totalEmDiligencia / totalGeral) * 100) : 0;

  return (
    <div className="signu-layout" style={{ background:"#060f1e", fontFamily:"'Inter',system-ui,sans-serif", color:"#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');
      `}</style>

      <Sidebar />

      {/* MAIN */}
      <main className="signu-main">
        {/* Top bar */}
        <header style={{ height:56,borderBottom:"1px solid rgba(201,168,76,0.1)",background:"#0a1628",display:"flex",alignItems:"center",padding:"0 28px",justifyContent:"space-between",flexShrink:0 }}>
          <div>
            <span style={{ fontSize:13,fontWeight:700,color:"#fff" }}>Início</span>
            <span style={{ fontSize:12,color:"rgba(255,255,255,0.3)",marginLeft:8 }}>SIGNU · NULEJ · TJDFT</span>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)",fontFamily:"'IBM Plex Mono',monospace" }}>
              {new Date().toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"})}
            </div>
            {totalAtrasados > 0 && (
              <div style={{ display:"flex",alignItems:"center",gap:5,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:20,padding:"4px 12px",fontSize:11,color:"#f87171",fontWeight:600 }}>
                ⚠️ {totalAtrasados} atrasados
              </div>
            )}
          </div>
        </header>

        <div className="signu-content">

          {/* Saudação */}
          <div style={{ marginBottom:24 }}>
            <h1 style={{ fontSize:20,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em" }}>
              {primeiroNome ? `${saudacao}, ${primeiroNome} 👋` : `${saudacao} 👋`}
            </h1>
            <p style={{ fontSize:13,color:"rgba(255,255,255,0.35)",margin:"4px 0 0" }}>Resumo operacional do NULEJ em tempo real.</p>
          </div>

          {/* KPI CARDS */}
          <div className="signu-grid-4" style={{ marginBottom:24 }}>
            {[
              { label:"Total de Bens",   value:totalGeral,        icon:"📦", color:"#c9a84c", sub:"em 6 listas operacionais" },
              { label:"Em Diligência",   value:totalEmDiligencia, icon:"⚡", color:"#22c55e", sub:`${taxaExecucao}% taxa de execução` },
              { label:"Bens Atrasados",  value:totalAtrasados,    icon:"⚠️", color:"#f87171", sub:"+30 dias sem atualização" },
              { label:"Minha Fila",      value:4,                 icon:"📋", color:"#60a5fa", sub:"itens atribuídos a você" },
            ].map(({ label,value,icon,color,sub }) => {
              const ainda = listas.some(l => l.carregando) && label !== "Minha Fila";
              return (
              <div key={label} style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:`1px solid ${color}22`,borderRadius:12,padding:"18px 20px",position:"relative",overflow:"hidden" }}>
                <div style={{ position:"absolute",top:0,right:0,width:60,height:60,borderRadius:"0 12px 0 60px",background:`${color}08` }}/>
                <div style={{ fontSize:22,marginBottom:8 }}>{icon}</div>
                <div style={{ fontSize:28,fontWeight:800,color:"#fff",lineHeight:1,marginBottom:4 }}>
                  {ainda ? <span style={{ fontSize:18,color:`${color}60` }}>…</span> : value.toLocaleString("pt-BR")}
                </div>
                <div style={{ fontSize:12,fontWeight:600,color,marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:11,color:"rgba(255,255,255,0.25)" }}>{sub}</div>
              </div>
            );})}
          </div>

          {/* GRID: LISTAS + LATERAL */}
          <div className="signu-grid-main" style={{ marginBottom:24 }}>
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:"rgba(201,168,76,0.7)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14 }}>Listas Operacionais</div>
              <div className="signu-grid-2">
                {LISTAS.map((lista) => {
                  const pct = Math.round((lista.em_diligencia/lista.total)*100);
                  return (
                    <div key={lista.key} onClick={() => router.push("/gestao")} onMouseEnter={()=>setHoveredCard(lista.key)} onMouseLeave={()=>setHoveredCard(null)} style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:`1px solid ${hoveredCard===lista.key?lista.color+"55":lista.color+"18"}`,borderRadius:12,padding:"16px 18px",cursor:"pointer",transition:"all 0.18s ease",transform:hoveredCard===lista.key?"translateY(-2px)":"none" }}>
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                          <span style={{ fontSize:18 }}>{lista.icon}</span>
                          <span style={{ fontSize:12,fontWeight:700,color:lista.color,background:lista.bg,padding:"2px 8px",borderRadius:4 }}>{lista.label}</span>
                        </div>
                        <span style={{ fontSize:22,fontWeight:800,color:"#fff" }}>
                          {lista.carregando ? <span style={{ fontSize:14,color:`${lista.color}60` }}>…</span> : lista.total.toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div style={{ height:4,background:"rgba(255,255,255,0.06)",borderRadius:4,marginBottom:10,overflow:"hidden" }}>
                        <div style={{ height:"100%",width:`${pct}%`,background:lista.color,borderRadius:4 }}/>
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4 }}>
                        <Stat label="Em dilig." value={lista.em_diligencia} color="#22c55e"/>
                        <Stat label="Aguard."  value={lista.aguardando}    color="#60a5fa"/>
                        <Stat label="Atrasados" value={lista.atrasados}    color={lista.atrasados>0?"#f87171":"rgba(255,255,255,0.25)"}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lateral */}
            <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
              {/* Minha Fila */}
              <div style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"16px 18px" }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
                  <div style={{ fontSize:11,fontWeight:700,color:"rgba(201,168,76,0.7)",textTransform:"uppercase",letterSpacing:"0.1em" }}>Minha Fila</div>
                  <button onClick={() => router.push("/fila")} style={{ fontSize:11,color:"#c9a84c",background:"none",border:"none",cursor:"pointer",fontWeight:600 }}>Ver todos →</button>
                </div>
                {MINHA_FILA_PREVIEW.map(item => (
                  <div key={item.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8,borderLeft:`3px solid ${item.color}`,marginBottom:6 }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:"rgba(255,255,255,0.5)",marginBottom:2 }}>{item.id}</div>
                      <div style={{ fontSize:12,fontWeight:600,color:"#fff" }}>{item.tipo}</div>
                    </div>
                    <div style={{ textAlign:"right",flexShrink:0 }}>
                      <div style={{ fontSize:10,fontWeight:600,color:STATUS_COLOR[item.status]||"#fff",marginBottom:2 }}>{item.status}</div>
                      <div style={{ fontSize:10,color:item.dias>30?"#f87171":"rgba(255,255,255,0.3)" }}>{item.dias}d</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Flows */}
              <div style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"16px 18px" }}>
                <div style={{ fontSize:11,fontWeight:700,color:"rgba(201,168,76,0.7)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14 }}>Power Automate — 6 Flows</div>
                {FLOWS.map(f => (
                  <div key={f.nome} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:7 }}>
                    <span style={{ width:6,height:6,borderRadius:"50%",background:"#22c55e",flexShrink:0,animation:"pulse 2s infinite" }}/>
                    <span style={{ fontSize:11,color:"rgba(255,255,255,0.6)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{f.icon} {f.nome}</span>
                    <span style={{ fontSize:10,color:"rgba(255,255,255,0.25)",flexShrink:0 }}>{f.ultimo}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══ RELATÓRIO DE TIPOS DE BENS ══ */}
          <div style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:"1px solid rgba(201,168,76,0.18)",borderRadius:16,padding:"20px 24px" }}>
            {/* Header do relatório */}
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12 }}>
              <div>
                <div style={{ fontSize:14,fontWeight:700,color:"#fff",marginBottom:3 }}>📊 Distribuição por Tipo de Bem</div>
                <div style={{ fontSize:11,color:"rgba(255,255,255,0.35)" }}>Carros, motos, caminhões diligenciados por lista</div>
              </div>
              <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
                {/* Filtro por lista */}
                <select value={filtroLista} onChange={e=>setFiltroLista(e.target.value)} style={{ padding:"5px 10px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:6,color:"#c9a84c",fontSize:12,cursor:"pointer",outline:"none" }}>
                  <option value="TODAS">Todas as listas</option>
                  {LISTAS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
                {/* Abas gráfico/tabela */}
                <div style={{ display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:8,padding:3,gap:2 }}>
                  {[["barras","📊 Barras"],["rosca","🍩 Pizza"],["tabela","📋 Tabela"]].map(([id,label]) => (
                    <button key={id} onClick={()=>setAbaRelatorio(id)} style={{ padding:"5px 12px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:abaRelatorio===id?"rgba(201,168,76,0.15)":"transparent",color:abaRelatorio===id?"#c9a84c":"rgba(255,255,255,0.4)",transition:"all 0.15s" }}>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Conteúdo dinâmico */}
            {abaRelatorio === "barras" && (
              <div>
                <GraficoBarras filtroLista={filtroLista} tiposPorLista={tiposPorLista}/>
                <div style={{ display:"flex",gap:12,marginTop:16,flexWrap:"wrap" }}>
                  {TIPOS.map(tipo => {
                    const chaves = filtroLista==="TODAS" ? Object.keys(tiposPorLista) : [filtroLista];
                    const total = chaves.reduce((a,l)=>a+(tiposPorLista[l]?.[tipo]||0),0);
                    if(!total) return null;
                    return (
                      <div key={tipo} style={{ display:"flex",alignItems:"center",gap:6,background:`${TIPO_COLOR[tipo]}12`,border:`1px solid ${TIPO_COLOR[tipo]}30`,borderRadius:8,padding:"6px 12px" }}>
                        <span>{TIPO_ICON[tipo]}</span>
                        <span style={{ fontSize:11,color:"rgba(255,255,255,0.6)" }}>{tipo}</span>
                        <span style={{ fontSize:13,fontWeight:800,color:"#fff" }}>{total}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {abaRelatorio === "rosca" && (
              <div style={{ display:"grid",gridTemplateColumns:"auto 1fr",gap:32,alignItems:"center" }}>
                <GraficoRosca filtroLista={filtroLista} tiposPorLista={tiposPorLista}/>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10 }}>
                  {TIPOS.map(tipo => {
                    const chaves = filtroLista==="TODAS" ? Object.keys(tiposPorLista) : [filtroLista];
                    const total = chaves.reduce((a,l)=>a+(tiposPorLista[l]?.[tipo]||0),0);
                    if(!total) return null;
                    const color = TIPO_COLOR[tipo];
                    return (
                      <div key={tipo} style={{ background:`${color}10`,border:`1px solid ${color}25`,borderRadius:10,padding:"12px 14px",textAlign:"center" }}>
                        <div style={{ fontSize:22,marginBottom:4 }}>{TIPO_ICON[tipo]}</div>
                        <div style={{ fontSize:20,fontWeight:800,color:"#fff" }}>{total}</div>
                        <div style={{ fontSize:10,color,fontWeight:600,marginTop:2 }}>{tipo}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {abaRelatorio === "tabela" && (
              <TabelaTipos filtroLista={filtroLista} tiposPorLista={tiposPorLista} LISTAS={LISTAS}/>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}