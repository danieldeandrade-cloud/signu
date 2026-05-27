"use client";
import Sidebar from "@/components/Sidebar";
import { useState, useMemo } from "react";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK = {
  CEGOC: [
    { id:"CEGOC-0142", ID_PASEI:"0038491-22.2024.8.07.0001", TIPO_BEM:"CARRO",       NIV:"9BWZZZ377VT004251", STATUS_DILIGENCIA:"EM DILIGÊNCIA", DESTINACAO:"EM DILIGÊNCIA HIGEIA", Responsavel:"Carla Araújo",     dias:12, FIB:false },
    { id:"CEGOC-0087", ID_PASEI:"0019273-55.2023.8.07.0015", TIPO_BEM:"MOTO",        NIV:"9C2JC4110LR501234", STATUS_DILIGENCIA:"ATRASADO",      DESTINACAO:"LPC",                  Responsavel:"Carla Araújo",     dias:34, FIB:false },
    { id:"CEGOC-0201", ID_PASEI:"0054321-11.2024.8.07.0002", TIPO_BEM:"CAMINHONETE", NIV:"8AFZZZ3CZGE123456", STATUS_DILIGENCIA:"AGUARDANDO",    DESTINACAO:"RENAJUD",              Responsavel:"Amanda Junqueira", dias:7,  FIB:true  },
    { id:"CEGOC-0333", ID_PASEI:"0091234-44.2023.8.07.0009", TIPO_BEM:"CAMINHÃO",    NIV:"9BM379182LB755001", STATUS_DILIGENCIA:"EM DILIGÊNCIA", DESTINACAO:"CIRCULAÇÃO",           Responsavel:"Marcelo Oliveira", dias:3,  FIB:false },
    { id:"CEGOC-0410", ID_PASEI:"0012345-55.2024.8.07.0011", TIPO_BEM:"CARRO",       NIV:"1HGBH41JXMN109111", STATUS_DILIGENCIA:"BAIXADO",       DESTINACAO:"CATÁLOGO",             Responsavel:"Letícia Mota",     dias:60, FIB:true  },
  ],
  PCDF_1HIGEIA: [
    { id:"PCDF1-0331", ID_PASEI:"0054812-11.2022.8.07.0003", TIPO_BEM:"CAMINHONETE", NIV:"8AFZZZ3CZGE123456", STATUS_DILIGENCIA:"AGUARDANDO",    DEPOSITO:"SELAB/PCDF", Responsavel:"Carla Araújo",     dias:5,  FIB:true,  CEB_TEP_TIV:true  },
    { id:"PCDF1-0204", ID_PASEI:"0032109-22.2023.8.07.0007", TIPO_BEM:"CARRO",       NIV:"9BWZZZ377VT009999", STATUS_DILIGENCIA:"EM DILIGÊNCIA", DEPOSITO:"CPA/PCDF",   Responsavel:"Carlos Caetano",   dias:18, FIB:false, CEB_TEP_TIV:false },
    { id:"PCDF1-0089", ID_PASEI:"0011122-33.2021.8.07.0005", TIPO_BEM:"MOTO",        NIV:"9C2JC4110LR599999", STATUS_DILIGENCIA:"ATRASADO",      DEPOSITO:"5ªDP",       Responsavel:"Amanda Junqueira", dias:41, FIB:false, CEB_TEP_TIV:false },
  ],
  PCDF_2HIGEIA: [
    { id:"PCDF2-0201", ID_PASEI:"0071009-44.2024.8.07.0007", TIPO_BEM:"CAMINHÃO",    NIV:"9BM379182LB755000", STATUS_DILIGENCIA:"EM DILIGÊNCIA", DEPOSITO:"CPA/PCDF", Responsavel:"Carla Araújo",   dias:19, RESTRICAO_ROUBO:true,  PA_TJDFT:"N/C"         },
    { id:"PCDF2-0099", ID_PASEI:"0041234-55.2023.8.07.0014", TIPO_BEM:"CARRO",       NIV:"1HGBH41JXMN100000", STATUS_DILIGENCIA:"AGUARDANDO",    DEPOSITO:"CPA",      Responsavel:"Loara Passo",    dias:9,  RESTRICAO_ROUBO:false, PA_TJDFT:"0041234-55"  },
  ],
  DPJ_GC99: [
    { id:"DPJ-0049", ID_PASEI:"0002341-88.2021.8.07.0020", TIPO_BEM:"CARRO",  NIV:"1HGBH41JXMN109186", STATUS_DILIGENCIA:"PRAZO 6 MESES", LOTE:49, PA_PJE:"0002341-88.2021", PRAZO_6MESES:"2026-05-28", Responsavel:"Cláudia Santos", dias:8  },
    { id:"DPJ-0031", ID_PASEI:"0009871-11.2020.8.07.0003", TIPO_BEM:"MOTO",   NIV:"9C2JC4110LR500001", STATUS_DILIGENCIA:"EM DILIGÊNCIA",  LOTE:31, PA_PJE:"0009871-11.2020", PRAZO_6MESES:"2026-06-15", Responsavel:"Cláudia Santos", dias:22 },
  ],
  DOACOES: [
    { id:"DOA-0004", ID_PASEI:"0038491-22.2024.8.07.0001", TIPO_BEM:"CARRO", ENTIDADE:"Associação Beneficente São Lucas", STATUS_LOCAL_PA:"EM ANÁLISE",        Responsavel:"Amanda Junqueira", dias:4  },
    { id:"DOA-0003", ID_PASEI:"0019273-55.2023.8.07.0015", TIPO_BEM:"MOTO",  ENTIDADE:"ONG Criança Feliz",               STATUS_LOCAL_PA:"AGUARDANDO ENTIDADE",Responsavel:"Letícia Mota",     dias:11 },
  ],
  CAIXA_SEI: [
    { id:"SEI-0032", ID_PASEI:"0071009-44.2024.8.07.0007", TIPO_BEM:"CAMINHÃO",    ACAO:"DILIGÊNCIA",         Responsavel:"Marcelo Oliveira", dias:1  },
    { id:"SEI-0031", ID_PASEI:"0054812-11.2022.8.07.0003", TIPO_BEM:"CAMINHONETE", ACAO:"AGUARDAR RETORNO",   Responsavel:"Carlos Caetano",   dias:3  },
    { id:"SEI-0030", ID_PASEI:"0032109-22.2023.8.07.0007", TIPO_BEM:"CARRO",       ACAO:"ENCAMINHAR",         Responsavel:"Carla Araújo",     dias:0  },
  ],
};

const LISTAS_TABS = [
  { key:"CEGOC",        label:"CEGOC",    color:"#3b82f6", bg:"#1e3a5f", icon:"🏛️" },
  { key:"PCDF_1HIGEIA", label:"PCDF 1ª", color:"#a78bfa", bg:"#3b1f5f", icon:"🚔" },
  { key:"PCDF_2HIGEIA", label:"PCDF 2ª", color:"#c084fc", bg:"#4a1f6f", icon:"🚔" },
  { key:"DPJ_GC99",     label:"DPJ-GC99",color:"#fb923c", bg:"#5f2a0e", icon:"⚖️" },
  { key:"DOACOES",      label:"Doações", color:"#34d399", bg:"#064e3b", icon:"🤝" },
  { key:"CAIXA_SEI",    label:"Caixa SEI",color:"#fbbf24",bg:"#451a03", icon:"📬" },
];

const STATUS_META = {
  "EM DILIGÊNCIA": { color:"#22c55e", bg:"rgba(34,197,94,0.12)"   },
  "AGUARDANDO":    { color:"#60a5fa", bg:"rgba(96,165,250,0.12)"  },
  "ATRASADO":      { color:"#f87171", bg:"rgba(248,113,113,0.12)" },
  "PRAZO 6 MESES": { color:"#fbbf24", bg:"rgba(251,191,36,0.12)"  },
  "BAIXADO":       { color:"#6b7280", bg:"rgba(107,114,128,0.12)" },
  "EM ANÁLISE":         { color:"#60a5fa", bg:"rgba(96,165,250,0.12)"  },
  "AGUARDANDO ENTIDADE":{ color:"#fbbf24", bg:"rgba(251,191,36,0.12)"  },
  "DILIGÊNCIA":         { color:"#22c55e", bg:"rgba(34,197,94,0.12)"   },
  "AGUARDAR RETORNO":   { color:"#fbbf24", bg:"rgba(251,191,36,0.12)"  },
  "ENCAMINHAR":         { color:"#a78bfa", bg:"rgba(167,139,250,0.12)" },
};

const TIPO_ICON = { CARRO:"🚗", MOTO:"🏍️", CAMINHONETE:"🛻", CAMINHÃO:"🚛", REBOQUE:"🚜", OUTROS:"📦" };

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { color:"#6b7280", bg:"rgba(107,114,128,0.12)" };
  return (
    <span style={{ fontSize:10, fontWeight:700, color:m.color, background:m.bg, padding:"3px 8px", borderRadius:20, border:`1px solid ${m.color}33`, whiteSpace:"nowrap" }}>
      {status}
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

export default function GestaoPage() {
  const [abaAtiva, setAbaAtiva] = useState("CEGOC");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [ordenacao, setOrdenacao] = useState({ campo:"dias", dir:"desc" });
  const [pag, setPag] = useState(1);
  const POR_PAGINA = 10;

  const tab = LISTAS_TABS.find(t => t.key === abaAtiva);
  const dados = MOCK[abaAtiva] || [];

  // Filtragem
  const filtrados = useMemo(() => {
    let res = [...dados];
    if (busca.trim()) {
      const q = busca.toLowerCase();
      res = res.filter(i =>
        i.ID_PASEI?.toLowerCase().includes(q) ||
        i.id?.toLowerCase().includes(q) ||
        i.NIV?.toLowerCase().includes(q) ||
        i.Responsavel?.toLowerCase().includes(q)
      );
    }
    const statusField = abaAtiva === "DOACOES" ? "STATUS_LOCAL_PA" : abaAtiva === "CAIXA_SEI" ? "ACAO" : "STATUS_DILIGENCIA";
    if (filtroStatus !== "TODOS") {
      res = res.filter(i => i[statusField] === filtroStatus);
    }
    res.sort((a, b) => {
      const va = a[ordenacao.campo] ?? 0;
      const vb = b[ordenacao.campo] ?? 0;
      const r = typeof va === "string" ? va.localeCompare(vb) : va - vb;
      return ordenacao.dir === "asc" ? r : -r;
    });
    return res;
  }, [dados, busca, filtroStatus, ordenacao, abaAtiva]);

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

  const statusOptions = [...new Set(dados.map(i => i.STATUS_DILIGENCIA || i.STATUS_LOCAL_PA || i.ACAO).filter(Boolean))];

  // Stats da aba atual
  const stats = useMemo(() => {
    const atrasados = dados.filter(i => i.STATUS_DILIGENCIA === "ATRASADO" || i.dias > 30).length;
    const emDilig   = dados.filter(i => i.STATUS_DILIGENCIA === "EM DILIGÊNCIA").length;
    const aguardando= dados.filter(i => i.STATUS_DILIGENCIA === "AGUARDANDO").length;
    return { total:dados.length, atrasados, emDilig, aguardando };
  }, [dados]);

  return (
    <div style={{ display:"flex", height:"100vh", background:"#060f1e", fontFamily:"'Inter',system-ui,sans-serif", color:"#e2e8f0", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.2);border-radius:4px}
        tr:hover td{background:rgba(255,255,255,0.025)!important}
      `}</style>

      <Sidebar />

      {/* MAIN */}
      <main style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Top bar */}
        <header style={{ height:56,borderBottom:"1px solid rgba(201,168,76,0.1)",background:"#0a1628",display:"flex",alignItems:"center",padding:"0 24px",gap:12,flexShrink:0 }}>
          <span style={{ fontSize:13,color:"rgba(255,255,255,0.4)" }}>SIGNU</span>
          <span style={{ color:"rgba(255,255,255,0.15)" }}>/</span>
          <span style={{ fontSize:13,fontWeight:700,color:"#fff" }}>Gestão</span>
          <span style={{ color:"rgba(255,255,255,0.15)" }}>/</span>
          <span style={{ fontSize:12,fontWeight:700,color:tab.color,background:tab.bg,padding:"2px 10px",borderRadius:4 }}>{tab.label}</span>
          <div style={{ flex:1 }}/>
          <span style={{ fontSize:11,color:"rgba(255,255,255,0.3)",fontFamily:"'IBM Plex Mono',monospace" }}>
            {filtrados.length} registro{filtrados.length!==1?"s":""}
          </span>
        </header>

        {/* ABAS */}
        <div style={{ background:"#0a1628",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"0 24px",display:"flex",gap:0,flexShrink:0,overflowX:"auto" }}>
          {LISTAS_TABS.map(t => (
            <button key={t.key} onClick={() => { setAbaAtiva(t.key); setBusca(""); setFiltroStatus("TODOS"); setPag(1); }}
              style={{
                padding:"12px 18px",border:"none",background:"transparent",cursor:"pointer",
                fontSize:12,fontWeight:abaAtiva===t.key?700:400,whiteSpace:"nowrap",
                color:abaAtiva===t.key?t.color:"rgba(255,255,255,0.4)",
                borderBottom:abaAtiva===t.key?`2px solid ${t.color}`:"2px solid transparent",
                transition:"all 0.15s",display:"flex",alignItems:"center",gap:6,
              }}>
              {t.icon} {t.label}
              <span style={{ fontSize:10,background:abaAtiva===t.key?t.bg:"rgba(255,255,255,0.06)",color:abaAtiva===t.key?t.color:"rgba(255,255,255,0.4)",padding:"1px 6px",borderRadius:10,fontWeight:700 }}>
                {(MOCK[t.key]||[]).length}
              </span>
            </button>
          ))}
        </div>

        <div style={{ flex:1,overflow:"auto",padding:"20px 24px 32px" }}>

          {/* Stats rápidos */}
          <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap" }}>
            {[
              { label:"Total",       value:stats.total,     color:tab.color },
              { label:"Em Diligência",value:stats.emDilig,  color:"#22c55e" },
              { label:"Aguardando",  value:stats.aguardando,color:"#60a5fa" },
              { label:"Atrasados",   value:stats.atrasados, color:"#f87171" },
            ].map(s => (
              <div key={s.label} style={{ display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"7px 14px" }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:s.color,flexShrink:0 }}/>
                <span style={{ fontSize:11,color:"rgba(255,255,255,0.4)" }}>{s.label}</span>
                <span style={{ fontSize:14,fontWeight:800,color:"#fff" }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Barra de filtros */}
          <div style={{ display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap" }}>
            {/* Busca */}
            <div style={{ position:"relative",flex:1,minWidth:200,maxWidth:320 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)" }}>
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
              </svg>
              <input value={busca} onChange={e=>{setBusca(e.target.value);setPag(1);}}
                placeholder="Buscar por PA, NIV, ID..."
                style={{ width:"100%",padding:"8px 10px 8px 32px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"#fff",fontSize:12,outline:"none" }}/>
            </div>
            {/* Filtro status */}
            <select value={filtroStatus} onChange={e=>{setFiltroStatus(e.target.value);setPag(1);}}
              style={{ padding:"8px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.7)",fontSize:12,cursor:"pointer",outline:"none" }}>
              <option value="TODOS" style={{ background:"#0a1628" }}>Todos os status</option>
              {statusOptions.map(s => <option key={s} value={s} style={{ background:"#0a1628" }}>{s}</option>)}
            </select>
            {(busca || filtroStatus!=="TODOS") && (
              <button onClick={()=>{setBusca("");setFiltroStatus("TODOS");setPag(1);}} style={{ padding:"7px 12px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:8,color:"#f87171",fontSize:11,cursor:"pointer",fontWeight:600 }}>
                ✕ Limpar
              </button>
            )}
          </div>

          {/* TABELA */}
          <div style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,overflow:"hidden" }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"rgba(255,255,255,0.02)" }}>
                    <ThSort campo="id">ID</ThSort>
                    <ThSort campo="ID_PASEI">ID_PASEI</ThSort>
                    <ThSort campo="TIPO_BEM">Tipo</ThSort>
                    <ThSort campo="NIV">NIV</ThSort>
                    {abaAtiva==="DPJ_GC99"     && <ThSort campo="LOTE">Lote</ThSort>}
                    {abaAtiva==="DPJ_GC99"     && <ThSort campo="PRAZO_6MESES">Prazo</ThSort>}
                    {(abaAtiva==="PCDF_1HIGEIA"||abaAtiva==="PCDF_2HIGEIA") && <ThSort campo="DEPOSITO">Depósito</ThSort>}
                    {abaAtiva==="DOACOES"       && <th style={{ padding:"10px 14px",fontSize:10,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600,borderBottom:"1px solid rgba(255,255,255,0.06)" }}>Entidade</th>}
                    <ThSort campo="STATUS_DILIGENCIA">Status</ThSort>
                    <ThSort campo="Responsavel">Responsável</ThSort>
                    <ThSort campo="dias">Dias</ThSort>
                    <th style={{ padding:"10px 14px",fontSize:10,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600,borderBottom:"1px solid rgba(255,255,255,0.06)" }}>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {pagina.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding:"48px",textAlign:"center",color:"rgba(255,255,255,0.2)",fontSize:13,fontStyle:"italic" }}>Nenhum registro encontrado.</td></tr>
                  ) : pagina.map((item, ri) => (
                    <tr key={item.id} style={{ cursor:"pointer", background: ri%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                      <Cell mono><span style={{ color:tab.color,fontWeight:700 }}>{item.id}</span></Cell>
                      <Cell mono muted>{item.ID_PASEI?.substring(0,20)}…</Cell>
                      <Cell>{TIPO_ICON[item.TIPO_BEM]} {item.TIPO_BEM}</Cell>
                      <Cell mono muted>{item.NIV || "—"}</Cell>
                      {abaAtiva==="DPJ_GC99"      && <Cell right>{item.LOTE ? `#${item.LOTE}` : "—"}</Cell>}
                      {abaAtiva==="DPJ_GC99"      && <Cell mono><span style={{ color: new Date(item.PRAZO_6MESES) <= new Date() ? "#f87171" : "rgba(255,255,255,0.7)" }}>{item.PRAZO_6MESES||"—"}</span></Cell>}
                      {(abaAtiva==="PCDF_1HIGEIA"||abaAtiva==="PCDF_2HIGEIA") && <Cell muted>{item.DEPOSITO||"—"}</Cell>}
                      {abaAtiva==="DOACOES"        && <Cell muted>{item.ENTIDADE?.substring(0,22)}…</Cell>}
                      <td style={{ padding:"11px 14px",borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <StatusBadge status={item.STATUS_DILIGENCIA||item.STATUS_LOCAL_PA||item.ACAO||"—"}/>
                      </td>
                      <Cell muted>{item.Responsavel?.split(" ")[0]}</Cell>
                      <td style={{ padding:"11px 14px",borderBottom:"1px solid rgba(255,255,255,0.04)",textAlign:"center" }}>
                        <span style={{ fontSize:11,fontWeight:700,color: item.dias>30?"#f87171":item.dias>15?"#fbbf24":"rgba(255,255,255,0.4)" }}>
                          {item.dias>30?"⚠ ":""}{item.dias}d
                        </span>
                      </td>
                      <td style={{ padding:"11px 14px",borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ display:"flex",gap:4 }}>
                          {item.FIB           && <span title="FIB"    style={{ fontSize:9,background:"rgba(34,197,94,0.15)",color:"#22c55e",padding:"2px 5px",borderRadius:4,fontWeight:700 }}>FIB</span>}
                          {item.CEB_TEP_TIV   && <span title="CEB"    style={{ fontSize:9,background:"rgba(96,165,250,0.15)",color:"#60a5fa",padding:"2px 5px",borderRadius:4,fontWeight:700 }}>CEB</span>}
                          {item.RESTRICAO_ROUBO&&<span title="Roubo"  style={{ fontSize:9,background:"rgba(248,113,113,0.15)",color:"#f87171",padding:"2px 5px",borderRadius:4,fontWeight:700 }}>🔒</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPags > 1 && (
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize:11,color:"rgba(255,255,255,0.3)" }}>
                  {(pag-1)*POR_PAGINA+1}–{Math.min(pag*POR_PAGINA,filtrados.length)} de {filtrados.length}
                </span>
                <div style={{ display:"flex",gap:6 }}>
                  <button onClick={()=>setPag(p=>Math.max(1,p-1))} disabled={pag===1} style={{ width:30,height:30,borderRadius:6,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:pag===1?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.6)",cursor:pag===1?"default":"pointer",fontSize:14 }}>‹</button>
                  {Array.from({length:totalPags},(_,i)=>i+1).map(n=>(
                    <button key={n} onClick={()=>setPag(n)} style={{ width:30,height:30,borderRadius:6,border:`1px solid ${n===pag?tab.color+"55":"rgba(255,255,255,0.08)"}`,background:n===pag?`${tab.color}18`:"transparent",color:n===pag?tab.color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:12,fontWeight:n===pag?700:400 }}>{n}</button>
                  ))}
                  <button onClick={()=>setPag(p=>Math.min(totalPags,p+1))} disabled={pag===totalPags} style={{ width:30,height:30,borderRadius:6,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:pag===totalPags?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.6)",cursor:pag===totalPags?"default":"pointer",fontSize:14 }}>›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}