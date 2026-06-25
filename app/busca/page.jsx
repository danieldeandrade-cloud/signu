"use client";
import Sidebar from "@/components/Sidebar";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── CONFIG DAS LISTAS PARA BUSCA ────────────────────────────────────────────
const LISTAS_BUSCA = [
  { key:"CEGOC",        rota:"cegoc",             prefixo:"CEG",  statusField:"STATUS_DILIGENCIA" },
  { key:"PCDF_1HIGEIA", rota:"pcdf1",             prefixo:"PCDF1",statusField:"STATUS_DILIGENCIA" },
  { key:"PCDF_2HIGEIA", rota:"pcdf2",             prefixo:"PCDF2",statusField:"STATUS_DILIGENCIA" },
  { key:"DPJ_GC99",     rota:"dpj",               prefixo:"DPJ",  statusField:"STATUS_DILIGENCIA" },
  { key:"DOACOES",      rota:"doacoes_diligencia", prefixo:"DOA",  statusField:"STATUS_LOCAL_PA"   },
  { key:"CAIXA_SEI",    rota:"sei",               prefixo:"SEI",  statusField:"ACAO"              },
];

// Normaliza um registro bruto da API para o formato de busca
function normalizar(raw, listaKey, prefixo) {
  const cfg = LISTAS_BUSCA.find(l => l.key === listaKey);
  return {
    ...raw,
    id:     raw.ID_LEGADO || `${prefixo}-${String(raw._rowNumber).padStart(4,"0")}`,
    lista:  listaKey,
    STATUS: raw[cfg?.statusField] || raw.STATUS_DILIGENCIA || raw.STATUS_LOCAL_PA || raw.ACAO || "",
  };
}

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

// Mapa lista key → rota da API (para montar a URL de detalhes)
const LISTA_ROTA = {
  CEGOC:        "cegoc",
  PCDF_1HIGEIA: "pcdf1",
  PCDF_2HIGEIA: "pcdf2",
  DPJ_GC99:     "dpj",
  DOACOES:      "doacoes_diligencia",
  CAIXA_SEI:    "sei",
};

// ─── RESULTADO CARD ───────────────────────────────────────────────────────────
function ResultCard({ item, termo, onOpen }) {
  const meta  = LISTA_META[item.lista] || LISTA_META.CEGOC;
  const stMeta = STATUS_META[item.STATUS] || { color:"#6b7280" };

  return (
    <div onClick={onOpen} style={{
      background:"linear-gradient(145deg,#0f2040,#0a1628)",
      border:`1px solid ${meta.color}22`,
      cursor:"pointer",
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
          <Highlight text={item.RESPONSAVEL || item.Responsavel || item.SERVIDOR || item.ATRIBUIDO_A || item.RESPONSAVEL_DILIGENCIA || ""} termo={termo}/>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function BuscaPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [buscado, setBuscado] = useState("");
  const [filtroLista, setFiltroLista] = useState("TODAS");
  const [buscando, setBuscando] = useState(false);
  const [indice, setIndice] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [listasCarregadas, setListasCarregadas] = useState(0);
  const inputRef = useRef(null);

  // Carrega todas as listas em paralelo no mount
  useEffect(() => {
    let carregadas = 0;
    const totalListas = LISTAS_BUSCA.length;

    LISTAS_BUSCA.forEach(async (cfg) => {
      try {
        const res = await fetch(`/api/bens/${cfg.rota}`);
        const json = await res.json();
        const normalizados = (json.dados || []).map(r => normalizar(r, cfg.key, cfg.prefixo));
        setIndice(prev => [...prev, ...normalizados]);
      } catch (e) {
        console.warn(`Erro ao carregar ${cfg.rota}:`, e);
      } finally {
        carregadas++;
        setListasCarregadas(carregadas);
        if (carregadas === totalListas) setCarregando(false);
      }
    });
  }, []);

  const executarBusca = (q) => {
    const termo = (q ?? query).trim();
    if (!termo) return;
    setBuscando(true);
    // Pequeno delay para feedback visual
    setTimeout(() => { setBuscado(termo); setBuscando(false); }, 150);
  };

  const resultados = buscado
    ? indice.filter(item => {
        // Pesquisa em todos os campos string do item (cobre qualquer nome de coluna da planilha)
        const campos = [item.id, ...Object.values(item).filter(v => typeof v === 'string')].join(" ").toLowerCase();
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
    <div className="signu-layout" style={{ background:"#060f1e", fontFamily:"'Inter',system-ui,sans-serif", color:"#e2e8f0" }}>
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
      <main className="signu-main">

        {/* Top bar */}
        <header style={{ height:56,borderBottom:"1px solid rgba(201,168,76,0.1)",background:"#0a1628",display:"flex",alignItems:"center",padding:"0 28px",flexShrink:0 }}>
          <span style={{ fontSize:13,color:"rgba(255,255,255,0.4)" }}>SIGNU</span>
          <span style={{ color:"rgba(255,255,255,0.15)",margin:"0 8px" }}>/</span>
          <span style={{ fontSize:13,fontWeight:700,color:"#fff" }}>Busca Global</span>
          <span style={{ fontSize:11,color:"rgba(255,255,255,0.25)",marginLeft:12 }}>
            {carregando
              ? `— carregando… ${listasCarregadas}/${LISTAS_BUSCA.length} listas`
              : `— ${indice.length.toLocaleString("pt-BR")} registros indexados em ${LISTAS_BUSCA.length} listas`}
          </span>
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
                      Todas ({resultados.length})
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
                  {resultados.map(item => <ResultCard key={item.id} item={item} termo={buscado} onOpen={() => router.push(`/detalhes?lista=${LISTA_ROTA[item.lista]}&row=${item._rowNumber}`)}/>)}
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
                        {items.map(item => <ResultCard key={item.id} item={item} termo={buscado} onOpen={() => router.push(`/detalhes?lista=${LISTA_ROTA[item.lista]}&row=${item._rowNumber}`)}/>)}
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
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
                {LISTAS_BUSCA.map(cfg => {
                  const meta = LISTA_META[cfg.key];
                  const total = indice.filter(i => i.lista === cfg.key).length;
                  return (
                    <div key={cfg.key} style={{ background:meta?.bg,border:`1px solid ${meta?.color}22`,borderRadius:8,padding:"10px 12px",textAlign:"center" }}>
                      <div style={{ fontSize:12,fontWeight:700,color:meta?.color,marginBottom:3 }}>{meta?.label}</div>
                      <div style={{ fontSize:10,color:"rgba(255,255,255,0.25)" }}>
                        {carregando && total === 0 ? "carregando…" : `${total} registros`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}