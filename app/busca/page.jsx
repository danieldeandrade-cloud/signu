"use client";
import Sidebar from "@/components/Sidebar";
import { useState, useRef } from "react";

// ─── ÍNDICE COMPLETO (todas as 9 listas) ─────────────────────────────────────
const INDICE = [
  { id:"CEGOC-0142",  lista:"CEGOC",        ID_PASEI:"0038491-22.2024.8.07.0001", TIPO_BEM:"CARRO",       NIV:"9BWZZZ377VT004251", STATUS:"EM DILIGÊNCIA", Responsavel:"Carla Araújo",     DESTINACAO:"EM DILIGÊNCIA HIGEIA" },
  { id:"CEGOC-0087",  lista:"CEGOC",        ID_PASEI:"0019273-55.2023.8.07.0015", TIPO_BEM:"MOTO",        NIV:"9C2JC4110LR501234", STATUS:"ATRASADO",      Responsavel:"Carla Araújo",     DESTINACAO:"LPC" },
  { id:"CEGOC-0201",  lista:"CEGOC",        ID_PASEI:"0054321-11.2024.8.07.0002", TIPO_BEM:"CAMINHONETE", NIV:"8AFZZZ3CZGE123456", STATUS:"AGUARDANDO",    Responsavel:"Amanda Junqueira", DESTINACAO:"RENAJUD" },
  { id:"CEGOC-0333",  lista:"CEGOC",        ID_PASEI:"0091234-44.2023.8.07.0009", TIPO_BEM:"CAMINHÃO",    NIV:"9BM379182LB755001", STATUS:"EM DILIGÊNCIA", Responsavel:"Marcelo Oliveira", DESTINACAO:"CIRCULAÇÃO" },
  { id:"PCDF1-0331",  lista:"PCDF_1HIGEIA", ID_PASEI:"0054812-11.2022.8.07.0003", TIPO_BEM:"CAMINHONETE", NIV:"8AFZZZ3CZGE123456", STATUS:"AGUARDANDO",    Responsavel:"Carla Araújo",     DEPOSITO:"SELAB/PCDF" },
  { id:"PCDF1-0204",  lista:"PCDF_1HIGEIA", ID_PASEI:"0032109-22.2023.8.07.0007", TIPO_BEM:"CARRO",       NIV:"9BWZZZ377VT009999", STATUS:"EM DILIGÊNCIA", Responsavel:"Carlos Caetano",   DEPOSITO:"CPA/PCDF" },
  { id:"PCDF1-0089",  lista:"PCDF_1HIGEIA", ID_PASEI:"0011122-33.2021.8.07.0005", TIPO_BEM:"MOTO",        NIV:"9C2JC4110LR599999", STATUS:"ATRASADO",      Responsavel:"Amanda Junqueira", DEPOSITO:"5ªDP" },
  { id:"PCDF2-0201",  lista:"PCDF_2HIGEIA", ID_PASEI:"0071009-44.2024.8.07.0007", TIPO_BEM:"CAMINHÃO",    NIV:"9BM379182LB755000", STATUS:"EM DILIGÊNCIA", Responsavel:"Carla Araújo",     DEPOSITO:"CPA/PCDF",  PA_TJDFT:"N/C" },
  { id:"PCDF2-0099",  lista:"PCDF_2HIGEIA", ID_PASEI:"0041234-55.2023.8.07.0014", TIPO_BEM:"CARRO",       NIV:"1HGBH41JXMN100000", STATUS:"AGUARDANDO",   Responsavel:"Loara Passo",      DEPOSITO:"CPA",       PA_TJDFT:"0041234-55" },
  { id:"DPJ-0049",    lista:"DPJ_GC99",     ID_PASEI:"0002341-88.2021.8.07.0020", TIPO_BEM:"CARRO",       NIV:"1HGBH41JXMN109186", STATUS:"PRAZO 6 MESES",Responsavel:"Cláudia Santos",   LOTE:49, PRAZO:"2026-05-28" },
  { id:"DPJ-0031",    lista:"DPJ_GC99",     ID_PASEI:"0009871-11.2020.8.07.0003", TIPO_BEM:"MOTO",        NIV:"9C2JC4110LR500001", STATUS:"EM DILIGÊNCIA", Responsavel:"Cláudia Santos",   LOTE:31, PRAZO:"2026-06-15" },
  { id:"DOA-0004",    lista:"DOACOES",      ID_PASEI:"0038491-22.2024.8.07.0001", TIPO_BEM:"CARRO",       NIV:"—",                 STATUS:"EM ANÁLISE",    Responsavel:"Amanda Junqueira", ENTIDADE:"Associação Beneficente São Lucas" },
  { id:"DOA-0003",    lista:"DOACOES",      ID_PASEI:"0019273-55.2023.8.07.0015", TIPO_BEM:"MOTO",        NIV:"—",                 STATUS:"AGUARDANDO ENTIDADE", Responsavel:"Letícia Mota", ENTIDADE:"ONG Criança Feliz" },
  { id:"DOA-RZ-0181", lista:"RETIRADOS",    ID_PASEI:"0077123-11.2023.8.07.0008", TIPO_BEM:"CAMINHONETE", NIV:"8AFZZZ3CZGE999999", STATUS:"BAIXADO",       Responsavel:"Marcelo Oliveira", OBSERVACOES:"Baixado por arrematação em leilão LPC." },
  { id:"SEI-0032",    lista:"CAIXA_SEI",    ID_PASEI:"0071009-44.2024.8.07.0007", TIPO_BEM:"CAMINHÃO",    NIV:"9BM379182LB111111", STATUS:"DILIGÊNCIA",    Responsavel:"Marcelo Oliveira", ACAO:"DILIGÊNCIA" },
  { id:"SEI-0031",    lista:"CAIXA_SEI",    ID_PASEI:"0054812-11.2022.8.07.0003", TIPO_BEM:"CAMINHONETE", NIV:"—",                 STATUS:"AGUARDAR RETORNO", Responsavel:"Carlos Caetano", ACAO:"AGUARDAR RETORNO" },
  { id:"ENTI-0001",   lista:"ENTIDADES",    ID_PASEI:"—",                         TIPO_BEM:"—",           NIV:"—",                 STATUS:"ATIVA",         Responsavel:"—",                ENTIDADE:"Associação Beneficente São Lucas", CNPJ:"12.345.678/0001-90" },
];

const LISTA_META = {
  CEGOC:        { label:"CEGOC",     color:"#3b82f6", bg:"#1e3a5f" },
  PCDF_1HIGEIA: { label:"PCDF 1ª",  color:"#a78bfa", bg:"#3b1f5f" },
  PCDF_2HIGEIA: { label:"PCDF 2ª",  color:"#c084fc", bg:"#4a1f6f" },
  DPJ_GC99:     { label:"DPJ-GC99", color:"#fb923c", bg:"#5f2a0e" },
  DOACOES:      { label:"Doações",  color:"#34d399", bg:"#064e3b" },
  CAIXA_SEI:    { label:"Caixa SEI",color:"#fbbf24", bg:"#451a03" },
  RETIRADOS:    { label:"Retirados",color:"#6b7280", bg:"#1f2937" },
  ENTIDADES:    { label:"Entidades",color:"#38bdf8", bg:"#0c2a3f" },
};

const STATUS_META = {
  "EM DILIGÊNCIA":      { color:"#22c55e" },
  "AGUARDANDO":         { color:"#60a5fa" },
  "ATRASADO":           { color:"#f87171" },
  "PRAZO 6 MESES":      { color:"#fbbf24" },
  "BAIXADO":            { color:"#6b7280" },
  "EM ANÁLISE":         { color:"#60a5fa" },
  "AGUARDANDO ENTIDADE":{ color:"#fbbf24" },
  "DILIGÊNCIA":         { color:"#22c55e" },
  "AGUARDAR RETORNO":   { color:"#fbbf24" },
  "ATIVA":              { color:"#34d399" },
};

const TIPO_ICON = { CARRO:"🚗", MOTO:"🏍️", CAMINHONETE:"🛻", CAMINHÃO:"🚛", REBOQUE:"🚜", OUTROS:"📦" };

const SUGESTOES = [
  { label:"Buscar por PA",     exemplo:"0038491-22.2024" },
  { label:"Buscar por NIV",    exemplo:"9BWZZZ377" },
  { label:"Buscar por ID",     exemplo:"CEGOC-0142" },
  { label:"Buscar responsável",exemplo:"Carla" },
];

// Highlight de termo na string
function Highlight({ text, termo }) {
  if (!termo || !text) return <>{text || "—"}</>;
  const idx = text.toLowerCase().indexOf(termo.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return <>
    {text.slice(0, idx)}
    <mark style={{ background:"rgba(201,168,76,0.35)", color:"#fff", borderRadius:2, padding:"0 1px" }}>{text.slice(idx, idx + termo.length)}</mark>
    {text.slice(idx + termo.length)}
  </>;
}

// ─── RESULTADO CARD ───────────────────────────────────────────────────────────
function ResultCard({ item, termo }) {
  const meta  = LISTA_META[item.lista] || LISTA_META.CEGOC;
  const stMeta = STATUS_META[item.STATUS] || { color:"#6b7280" };

  return (
    <div style={{
      background:"linear-gradient(145deg,#0f2040,#0a1628)",
      border:`1px solid ${meta.color}22`,
      borderLeft:`3px solid ${meta.color}`,
      borderRadius:10, padding:"14px 18px",
      cursor:"pointer", transition:"all 0.15s",
      display:"grid", gridTemplateColumns:"1fr auto",
      gap:12, alignItems:"start",
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor=`${meta.color}66`; e.currentTarget.style.transform="translateX(3px)"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor=`${meta.color}22`; e.currentTarget.style.transform="translateX(0)"; }}
    >
      <div>
        {/* Linha 1: badge lista + ID + tipo */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7, flexWrap:"wrap" }}>
          <span style={{ fontSize:10,fontWeight:700,color:meta.color,background:meta.bg,padding:"2px 8px",borderRadius:4,letterSpacing:"0.05em" }}>{meta.label}</span>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace",fontSize:12,fontWeight:700,color:"#fff" }}>
            <Highlight text={item.id} termo={termo}/>
          </span>
          <span style={{ fontSize:12 }}>{TIPO_ICON[item.TIPO_BEM]}</span>
          <span style={{ fontSize:12,color:"rgba(255,255,255,0.6)",fontWeight:500 }}>{item.TIPO_BEM !== "—" ? item.TIPO_BEM : ""}</span>
        </div>

        {/* Linha 2: ID_PASEI */}
        <div style={{ fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#c9a84c",marginBottom:7 }}>
          <Highlight text={item.ID_PASEI} termo={termo}/>
        </div>

        {/* Linha 3: campos extras */}
        <div style={{ display:"flex",gap:16,flexWrap:"wrap" }}>
          {item.NIV && item.NIV !== "—" && (
            <div>
              <span style={{ fontSize:9,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.08em" }}>NIV </span>
              <span style={{ fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:"rgba(255,255,255,0.6)" }}>
                <Highlight text={item.NIV} termo={termo}/>
              </span>
            </div>
          )}
          {item.DESTINACAO && (
            <div>
              <span style={{ fontSize:9,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.08em" }}>Dest. </span>
              <span style={{ fontSize:11,color:"rgba(255,255,255,0.5)" }}>{item.DESTINACAO}</span>
            </div>
          )}
          {item.DEPOSITO && (
            <div>
              <span style={{ fontSize:9,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.08em" }}>Depósito </span>
              <span style={{ fontSize:11,color:"rgba(255,255,255,0.5)" }}>{item.DEPOSITO}</span>
            </div>
          )}
          {item.LOTE && (
            <div>
              <span style={{ fontSize:9,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.08em" }}>Lote </span>
              <span style={{ fontSize:11,color:"rgba(255,255,255,0.5)" }}>#{item.LOTE}</span>
            </div>
          )}
          {item.ENTIDADE && (
            <div>
              <span style={{ fontSize:9,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.08em" }}>Entidade </span>
              <span style={{ fontSize:11,color:"rgba(255,255,255,0.5)" }}>{item.ENTIDADE}</span>
            </div>
          )}
          {item.OBSERVACOES && (
            <div style={{ width:"100%" }}>
              <span style={{ fontSize:11,color:"rgba(255,255,255,0.35)",fontStyle:"italic" }}>{item.OBSERVACOES.substring(0,80)}…</span>
            </div>
          )}
        </div>
      </div>

      {/* Direita: status + responsável */}
      <div style={{ textAlign:"right",flexShrink:0 }}>
        <div style={{ fontSize:10,fontWeight:700,color:stMeta.color,marginBottom:5 }}>{item.STATUS}</div>
        <div style={{ fontSize:11,color:"rgba(255,255,255,0.35)" }}>
          <Highlight text={item.Responsavel} termo={termo}/>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function BuscaPage() {
  const [query, setQuery] = useState("");
  const [buscado, setBuscado] = useState("");
  const [filtroLista, setFiltroLista] = useState("TODAS");
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef(null);

  const executarBusca = (q) => {
    const termo = (q ?? query).trim();
    if (!termo) return;
    setBuscando(true);
    setTimeout(() => { setBuscado(termo); setBuscando(false); }, 400);
  };

  const resultados = buscado
    ? INDICE.filter(item => {
        const campos = [item.id, item.ID_PASEI, item.NIV, item.Responsavel, item.DESTINACAO, item.DEPOSITO, item.ENTIDADE, item.ACAO, item.OBSERVACOES].filter(Boolean).join(" ").toLowerCase();
        const match = campos.includes(buscado.toLowerCase());
        if (!match) return false;
        if (filtroLista !== "TODAS" && item.lista !== filtroLista) return false;
        return true;
      })
    : [];

  // Agrupar por lista
  const porLista = resultados.reduce((acc, item) => {
    if (!acc[item.lista]) acc[item.lista] = [];
    acc[item.lista].push(item);
    return acc;
  }, {});

  const limpar = () => { setQuery(""); setBuscado(""); setFiltroLista("TODAS"); inputRef.current?.focus(); };

  return (
    <div style={{ display:"flex", height:"100vh", background:"#060f1e", fontFamily:"'Inter',system-ui,sans-serif", color:"#e2e8f0", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.2);border-radius:4px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
      `}</style>

      <Sidebar />

      {/* MAIN */}
      <main style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* Top bar */}
        <header style={{ height:56,borderBottom:"1px solid rgba(201,168,76,0.1)",background:"#0a1628",display:"flex",alignItems:"center",padding:"0 28px",flexShrink:0 }}>
          <span style={{ fontSize:13,color:"rgba(255,255,255,0.4)" }}>SIGNU</span>
          <span style={{ color:"rgba(255,255,255,0.15)",margin:"0 8px" }}>/</span>
          <span style={{ fontSize:13,fontWeight:700,color:"#fff" }}>Busca Global</span>
          <span style={{ fontSize:11,color:"rgba(255,255,255,0.25)",marginLeft:12 }}>— {INDICE.length} registros indexados em {Object.keys(LISTA_META).length} listas</span>
        </header>

        <div style={{ flex:1,overflow:"auto" }}>

          {/* HERO DE BUSCA */}
          <div style={{
            padding: buscado ? "20px 28px 16px" : "60px 28px 40px",
            background: buscado ? "#0a1628" : "linear-gradient(180deg,#0a1628 0%,#060f1e 100%)",
            borderBottom: buscado ? "1px solid rgba(255,255,255,0.06)" : "none",
            transition:"all 0.3s ease",
          }}>
            {!buscado && (
              <div style={{ textAlign:"center",marginBottom:28 }}>
                <div style={{ fontSize:36,marginBottom:10 }}>🔍</div>
                <h1 style={{ fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 6px",letterSpacing:"-0.03em" }}>Busca Global SIGNU</h1>
                <p style={{ fontSize:13,color:"rgba(255,255,255,0.35)",margin:0 }}>Pesquise por PA, NIV, ID do bem ou servidor em todas as listas simultaneamente</p>
              </div>
            )}

            {/* Campo de busca */}
            <div style={{ maxWidth:640,margin:"0 auto",position:"relative" }}>
              <div style={{
                display:"flex",alignItems:"center",
                background:"rgba(255,255,255,0.06)",
                border:`2px solid ${query || buscado ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.1)"}`,
                borderRadius:14,overflow:"hidden",
                transition:"border 0.2s",
                boxShadow: query || buscado ? "0 0 24px rgba(201,168,76,0.1)" : "none",
              }}>
                <div style={{ padding:"0 16px",color:"rgba(255,255,255,0.3)",flexShrink:0 }}>
                  {buscando
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" style={{ animation:"spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="9" strokeDasharray="28" strokeDashoffset="10"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
                  }
                </div>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && executarBusca()}
                  placeholder="Pesquisar PA, NIV, ID, servidor..."
                  autoFocus
                  style={{ flex:1,padding:"14px 0",background:"transparent",border:"none",color:"#fff",fontSize:15,outline:"none" }}
                />
                {(query || buscado) && (
                  <button onClick={limpar} style={{ padding:"0 14px",background:"none",border:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:18 }}>×</button>
                )}
                <button onClick={() => executarBusca()} style={{
                  padding:"12px 22px",background:"linear-gradient(135deg,#c9a84c,#8b6914)",
                  border:"none",color:"#0a1628",fontSize:13,fontWeight:700,cursor:"pointer",
                  borderRadius:"0 12px 12px 0",
                }}>Buscar</button>
              </div>

              {/* Sugestões */}
              {!buscado && (
                <div style={{ display:"flex",gap:8,marginTop:14,justifyContent:"center",flexWrap:"wrap" }}>
                  {SUGESTOES.map(s => (
                    <button key={s.exemplo} onClick={() => { setQuery(s.exemplo); executarBusca(s.exemplo); }}
                      style={{ padding:"5px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,color:"rgba(255,255,255,0.45)",fontSize:11,cursor:"pointer",transition:"all 0.15s" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(201,168,76,0.4)";e.currentTarget.style.color="#c9a84c";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";e.currentTarget.style.color="rgba(255,255,255,0.45)";}}>
                      {s.label}: <strong>{s.exemplo}</strong>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RESULTADOS */}
          {buscado && (
            <div style={{ padding:"20px 28px 40px",animation:"fadeIn 0.3s ease" }}>

              {/* Header dos resultados */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10 }}>
                <div>
                  <span style={{ fontSize:14,fontWeight:700,color:"#fff" }}>
                    {resultados.length > 0
                      ? <>{resultados.length} resultado{resultados.length!==1?"s":""} para <span style={{ color:"#c9a84c" }}>"{buscado}"</span></>
                      : <>Nenhum resultado para <span style={{ color:"#f87171" }}>"{buscado}"</span></>
                    }
                  </span>
                  {resultados.length > 0 && (
                    <span style={{ fontSize:11,color:"rgba(255,255,255,0.3)",marginLeft:10 }}>
                      em {Object.keys(porLista).length} lista{Object.keys(porLista).length!==1?"s":""}
                    </span>
                  )}
                </div>

                {/* Filtro por lista */}
                {resultados.length > 0 && (
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    <button onClick={()=>setFiltroLista("TODAS")} style={{ padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:filtroLista==="TODAS"?700:400,border:`1px solid ${filtroLista==="TODAS"?"rgba(201,168,76,0.5)":"rgba(255,255,255,0.1)"}`,background:filtroLista==="TODAS"?"rgba(201,168,76,0.1)":"transparent",color:filtroLista==="TODAS"?"#c9a84c":"rgba(255,255,255,0.4)",cursor:"pointer" }}>
                      Todas ({INDICE.filter(i=>[i.id,i.ID_PASEI,i.NIV,i.Responsavel,i.DESTINACAO,i.DEPOSITO,i.ENTIDADE,i.ACAO,i.OBSERVACOES].filter(Boolean).join(" ").toLowerCase().includes(buscado.toLowerCase())).length})
                    </button>
                    {Object.entries(porLista).map(([key,items]) => {
                      const meta = LISTA_META[key];
                      return (
                        <button key={key} onClick={()=>setFiltroLista(key===filtroLista?"TODAS":key)}
                          style={{ padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:filtroLista===key?700:400,border:`1px solid ${filtroLista===key?meta.color+"66":"rgba(255,255,255,0.1)"}`,background:filtroLista===key?meta.bg:"transparent",color:filtroLista===key?meta.color:"rgba(255,255,255,0.4)",cursor:"pointer" }}>
                          {meta.label} ({items.length})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Resultados agrupados por lista */}
              {resultados.length === 0 ? (
                <div style={{ textAlign:"center",padding:"60px 20px",color:"rgba(255,255,255,0.2)" }}>
                  <div style={{ fontSize:40,marginBottom:12 }}>🔍</div>
                  <div style={{ fontSize:14,marginBottom:8 }}>Nenhum bem encontrado</div>
                  <div style={{ fontSize:12 }}>Tente buscar por PA, NIV, ID ou nome do responsável</div>
                </div>
              ) : filtroLista !== "TODAS" ? (
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {resultados.map(item => <ResultCard key={item.id} item={item} termo={buscado}/>)}
                </div>
              ) : (
                Object.entries(porLista).map(([listaKey, items]) => {
                  const meta = LISTA_META[listaKey];
                  return (
                    <div key={listaKey} style={{ marginBottom:24 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                        <span style={{ fontSize:11,fontWeight:700,color:meta.color,background:meta.bg,padding:"3px 10px",borderRadius:4,letterSpacing:"0.06em" }}>{meta.label}</span>
                        <span style={{ fontSize:11,color:"rgba(255,255,255,0.25)" }}>{items.length} resultado{items.length!==1?"s":""}</span>
                        <div style={{ flex:1,height:1,background:"rgba(255,255,255,0.04)"}}/>
                      </div>
                      <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                        {items.map(item => <ResultCard key={item.id} item={item} termo={buscado}/>)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Estado vazio sem busca */}
          {!buscado && (
            <div style={{ padding:"0 28px 40px",maxWidth:640,margin:"0 auto" }}>
              <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.2)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14,textAlign:"center" }}>
                Listas disponíveis para busca
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
                {Object.entries(LISTA_META).map(([key,meta]) => (
                  <div key={key} style={{ background:meta.bg,border:`1px solid ${meta.color}22`,borderRadius:8,padding:"10px 12px",textAlign:"center" }}>
                    <div style={{ fontSize:12,fontWeight:700,color:meta.color,marginBottom:3 }}>{meta.label}</div>
                    <div style={{ fontSize:10,color:"rgba(255,255,255,0.25)" }}>{INDICE.filter(i=>i.lista===key).length} registros</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}