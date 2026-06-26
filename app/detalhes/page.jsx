"use client";

import Sidebar from "@/components/Sidebar";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// Mapa rota API → chave interna de lista
const ROTA_TO_KEY = {
  cegoc:              "CEGOC",
  pcdf1:              "PCDF_1HIGEIA",
  pcdf2:              "PCDF_2HIGEIA",
  dpj:                "DPJ_GC99",
  doacoes_diligencia: "DOACOES",
  sei:                "CAIXA_SEI",
};

const TIPOS_BEM   = ["CARRO","MOTO","CAMINHÃO","CAMINHONETE","REBOQUE","OUTROS"];
const DESTINACOES = ["CIRCULAÇÃO","RECICLAGEM"];
const DEPOSITOS   = ["SELAB/PCDF","CPA/PCDF","CPA","CEGOC","5ªDP","23ªDP","30ªDP","33ªDP"];

const STATUS_OPTIONS = ["AGUARDANDO","EM DILIGÊNCIA","ATRASADO","PRAZO 6 MESES","BAIXADO","EM DILIGÊNCIA HIGEIA","LPC","CATÁLOGO","RENAJUD"];

const LISTA_META = {
  CEGOC:        { label: "CEGOC",     color: "#3b82f6", bg: "#1e3a5f" },
  PCDF_1HIGEIA: { label: "PCDF 1ª",  color: "#a78bfa", bg: "#3b1f5f" },
  PCDF_2HIGEIA: { label: "PCDF 2ª",  color: "#c084fc", bg: "#4a1f6f" },
  DPJ_GC99:     { label: "DPJ-GC99", color: "#fb923c", bg: "#5f2a0e" },
  DOACOES:      { label: "Doações",  color: "#34d399", bg: "#064e3b" },
  CAIXA_SEI:    { label: "Caixa SEI",color: "#fbbf24", bg: "#451a03" },
};

const STATUS_META = {
  "EM DILIGÊNCIA": { color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  "AGUARDANDO":    { color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  "ATRASADO":      { color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  "PRAZO 6 MESES": { color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  "BAIXADO":       { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const TIPO_ICON = { CARRO:"🚗", MOTO:"🏍️", CAMINHONETE:"🛻", CAMINHÃO:"🚛", REBOQUE:"🚜", OUTROS:"📦" };

// Helpers para leitura de campos booleanos gravados como "TRUE"/"FALSE" string
function boolVal(v) { return v === true || v === "TRUE" || v === "Sim"; }
function boolStr(v) { return v ? "TRUE" : "FALSE"; }

// Nome do responsável (vem como string simples da planilha)
function nomeResp(bem) {
  return bem?.RESPONSAVEL || bem?.Responsavel || bem?.SERVIDOR || bem?.ATRIBUIDO_A || "";
}

// ID de exibição
function displayId(bem, listaKey) {
  if (bem?.ID_LEGADO) return bem.ID_LEGADO;
  const prefixo = { CEGOC:"CEG", PCDF_1HIGEIA:"PCDF1", PCDF_2HIGEIA:"PCDF2", DPJ_GC99:"DPJ", DOACOES:"DOA", CAIXA_SEI:"SEI" }[listaKey] || "BEM";
  return `${prefixo}-${String(bem?._rowNumber || 0).padStart(4,"0")}`;
}

// ─── HISTÓRICO ────────────────────────────────────────────────────────────────
// A rota de transição grava entradas no formato: [DD/MM/YYYY, HH:MM:SS] texto
function parseHistorico(bem, listaKey) {
  const entries = [];

  if (bem?.DATA_CADASTRO) {
    entries.push({
      data: bem.DATA_CADASTRO, icon: "📥", cor: "#a78bfa",
      acao: "Bem cadastrado no SIGNU",
      detalhe: `Lista: ${LISTA_META[listaKey]?.label || listaKey}`,
    });
  }

  // Extrai blocos [timestamp] do campo OBSERVACOES
  const obs = bem?.OBSERVACOES || "";
  const regex = /\[([^\]]+)\]([\s\S]*?)(?=\[[^\]]+\]|$)/g;
  let m;
  while ((m = regex.exec(obs)) !== null) {
    const texto = m[2].trim();
    if (!texto) continue;
    const isTransicao = /transição|migra|CATÁLOGO|HIGEIA/i.test(texto);
    entries.push({
      data: m[1].trim(), icon: isTransicao ? "🔄" : "✏️",
      cor: isTransicao ? "#fbbf24" : "#60a5fa",
      acao: texto.length > 120 ? texto.slice(0, 117) + "…" : texto,
      detalhe: "",
    });
  }

  if (bem?.DATA_ATUALIZACAO && bem.DATA_ATUALIZACAO !== bem.DATA_CADASTRO) {
    entries.push({
      data: bem.DATA_ATUALIZACAO, icon: "🔄", cor: "#22c55e",
      acao: `Status atual: ${bem.STATUS_DILIGENCIA || "—"}`,
      detalhe: `Responsável: ${nomeResp(bem) || "—"}`,
    });
  }

  return entries;
}

// Formata bytes em KB/MB
function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// Ícone por tipo MIME
function fileIcon(type) {
  if (type.includes("pdf"))   return "📄";
  if (type.includes("image")) return "🖼️";
  if (type.includes("word") || type.includes("document")) return "📝";
  return "📎";
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Ico = {
  Back:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  Edit:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Save:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Cancel:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Upload:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Alert:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>,
  Arrow:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Spinner: ({ color="#c9a84c", size=20 }) => <div style={{ width:size,height:size,border:`2px solid ${color}30`,borderTop:`2px solid ${color}`,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0 }}/>,
};

// ─── FIELD COMPONENTS ─────────────────────────────────────────────────────────
function FieldView({ label, value, mono, highlight, children }) {
  return (
    <div>
      <div style={{ fontSize:10,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5 }}>{label}</div>
      {children || (
        <div style={{ fontSize:13,fontFamily:mono?"'IBM Plex Mono',monospace":"inherit",color:highlight||"rgba(255,255,255,0.85)",fontWeight:500,lineHeight:1.4 }}>
          {value || <span style={{ color:"rgba(255,255,255,0.2)",fontStyle:"italic" }}>—</span>}
        </div>
      )}
    </div>
  );
}

function FieldEdit({ label, value, onChange, type="text", options }) {
  const st = { width:"100%",padding:"8px 10px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:6,color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box" };
  return (
    <div>
      <div style={{ fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5 }}>{label}</div>
      {options ? (
        <select value={value||""} onChange={e=>onChange(e.target.value)} style={{ ...st,cursor:"pointer" }}>
          {options.map(o=><option key={o} value={o} style={{ background:"#0a1628" }}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} style={st}/>
      )}
    </div>
  );
}

function Toggle({ label, value, onChange, editMode }) {
  const isOn = boolVal(value);
  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize:13,color:"rgba(255,255,255,0.7)" }}>{label}</span>
      {editMode ? (
        <button onClick={()=>onChange(!isOn)} style={{ width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",background:isOn?"#22c55e":"rgba(255,255,255,0.1)",position:"relative",transition:"background 0.2s" }}>
          <span style={{ position:"absolute",top:3,left:isOn?23:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s" }}/>
        </button>
      ) : (
        <span style={{ fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:12,color:isOn?"#22c55e":"rgba(255,255,255,0.3)",background:isOn?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.04)" }}>
          {isOn?"✓ Sim":"Não"}
        </span>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"18px 20px" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(201,168,76,0.7)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:16 }}>{title}</div>
      {children}
    </div>
  );
}

// ─── TRANSIÇÃO MODAL ──────────────────────────────────────────────────────────
function TransicaoModal({ tipo, bem, onClose, onConfirm, salvando }) {
  const [obs, setObs] = useState("");
  const isHigeia = tipo === "HIGEIA";

  return (
    <div style={{ position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div onClick={onClose} style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)" }}/>
      <div style={{ position:"relative",width:460,background:"linear-gradient(145deg,#0f2040,#0a1628)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:16,padding:28,zIndex:1 }}>
        <div style={{ fontSize:11,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8 }}>Confirmar Transição</div>
        <h2 style={{ fontSize:18,fontWeight:700,color:"#fff",margin:"0 0 4px" }}>
          {isHigeia?"🏛️ Mover para PCDF 2ª HIGEIA":"📋 Concluir LPC → CATÁLOGO"}
        </h2>
        <p style={{ fontSize:13,color:"rgba(255,255,255,0.45)",margin:"0 0 20px",lineHeight:1.5 }}>
          {isHigeia
            ? `O bem será criado em Bens_PCDF_2HIGEIA e removido de Bens_CEGOC.`
            : `O campo DESTINACAO será alterado para CATÁLOGO. O item permanece em Bens_CEGOC.`}
        </p>
        <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 14px",marginBottom:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 16px" }}>
          {[["ID_PASEI",bem?.ID_PASEI],["Tipo",bem?.TIPO_BEM],["NIV",bem?.NIV],["Destino atual",bem?.DESTINACAO]].map(([l,v])=>(
            <div key={l}>
              <div style={{ fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:"0.08em",marginBottom:2 }}>{l}</div>
              <div style={{ fontSize:12,color:"rgba(255,255,255,0.8)",fontFamily:"'IBM Plex Mono',monospace" }}>{v||"—"}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6 }}>Observação *</div>
          <textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Descreva o motivo da transição..."
            style={{ width:"100%",minHeight:80,padding:"10px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:8,color:"#fff",fontSize:13,resize:"vertical",outline:"none",lineHeight:1.5,boxSizing:"border-box" }}/>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose} disabled={salvando} style={{ flex:1,padding:"11px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.5)",fontSize:13,cursor:"pointer" }}>Cancelar</button>
          <button onClick={()=>obs.trim()&&!salvando&&onConfirm(obs)} disabled={!obs.trim()||salvando}
            style={{ flex:2,padding:"11px",borderRadius:8,border:"none",cursor:obs.trim()&&!salvando?"pointer":"not-allowed",
              background:obs.trim()&&!salvando?(isHigeia?"linear-gradient(135deg,#8b6914,#3b82f6)":"linear-gradient(135deg,#15803d,#22c55e)"):"rgba(255,255,255,0.06)",
              color:obs.trim()&&!salvando?"#fff":"rgba(255,255,255,0.3)",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
            {salvando ? <><Ico.Spinner size={14}/> Aguarde…</> : (isHigeia?"✓ Confirmar Migração":"✓ Confirmar Transição")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const ok = type==="success";
  return (
    <div style={{ position:"fixed",bottom:28,right:28,zIndex:200,display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderRadius:12,
      background:ok?"linear-gradient(135deg,#15803d,#166534)":"linear-gradient(135deg,#991b1b,#7f1d1d)",
      border:`1px solid ${ok?"rgba(34,197,94,0.4)":"rgba(248,113,113,0.4)"}`,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
      fontSize:14,fontWeight:600,color:"#fff",animation:"slideUp 0.3s ease" }}>
      {ok?"✅":"❌"} {msg}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
function DetalhesContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const lista        = searchParams.get("lista"); // ex: "cegoc"
  const row          = searchParams.get("row");   // ex: "142"
  const listaKey     = ROTA_TO_KEY[lista] || "CEGOC";
  const meta         = LISTA_META[listaKey] || LISTA_META.CEGOC;

  const [bem,         setBem]         = useState(null);
  const [editMode,    setEditMode]    = useState(false);
  const [editData,    setEditData]    = useState(null);
  const [modal,       setModal]       = useState(null); // "HIGEIA" | "CATALOGO"
  const [toast,       setToast]       = useState({ msg:"", type:"" });
  const [activeTab,   setActiveTab]   = useState("dados");
  const [loading,     setLoading]     = useState(true);
  const [salvando,    setSalvando]    = useState(false);
  const [erroLoad,    setErroLoad]    = useState(null);
  // Anexos (Google Drive)
  const [anexos,         setAnexos]        = useState([]);
  const [arrastando,     setArrastando]    = useState(false);
  const [uploadando,     setUploadando]    = useState(false);
  const [carregandoAnexos, setCarregandoAnexos] = useState(false);
  const fileInputRef = useRef(null);

  // Carrega anexos existentes do Drive quando a aba é aberta
  const carregarAnexos = useCallback(async () => {
    if (!lista || !row) return;
    setCarregandoAnexos(true);
    try {
      const res = await fetch(`/api/anexos/${lista}/${row}`);
      const json = await res.json();
      if (json.arquivos) {
        setAnexos(json.arquivos.map(f => ({
          id: f.id,
          nome: f.name,
          tamanho: Number(f.size || 0),
          tipo: f.mimeType || '',
          data: f.createdTime ? new Date(f.createdTime).toLocaleString('pt-BR') : '',
          url: f.webViewLink,
          salvo: true,
        })));
      }
    } catch (e) {
      console.error('Erro ao carregar anexos:', e);
    } finally {
      setCarregandoAnexos(false);
    }
  }, [lista, row]);

  useEffect(() => {
    if (activeTab === 'anexos') carregarAnexos();
  }, [activeTab, carregarAnexos]);

  const addFiles = useCallback(async (files) => {
    if (!lista || !row) return;
    setUploadando(true);
    for (const file of [...files]) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch(`/api/anexos/${lista}/${row}`, { method: 'POST', body: fd });
        const json = await res.json();
        if (json.arquivo) {
          const f = json.arquivo;
          setAnexos(prev => [{
            id: f.id, nome: f.name, tamanho: Number(f.size || 0),
            tipo: f.mimeType || '', data: f.createdTime ? new Date(f.createdTime).toLocaleString('pt-BR') : '',
            url: f.webViewLink, salvo: true,
          }, ...prev]);
        }
      } catch (e) {
        console.error('Erro no upload:', e);
      }
    }
    setUploadando(false);
  }, [lista, row]);

  const removerAnexo = async (id) => {
    try {
      await fetch(`/api/anexos/${lista}/${row}?id=${id}`, { method: 'DELETE' });
      setAnexos(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error('Erro ao remover anexo:', e);
    }
  };

  // Carrega o item da API
  useEffect(() => {
    if (!lista || !row) return;
    setLoading(true);
    setErroLoad(null);
    fetch(`/api/bens/${lista}/${row}`)
      .then(r => r.json())
      .then(json => {
        if (json.erro) throw new Error(json.erro);
        setBem(json.item);
      })
      .catch(e => setErroLoad(e.message))
      .finally(() => setLoading(false));
  }, [lista, row]);

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(()=>setToast({ msg:"", type:"" }), 3500);
  };

  const handleEdit = () => {
    setEditData({ ...bem });
    setEditMode(true);
  };

  const handleSave = async () => {
    setSalvando(true);
    try {
      // Serializa booleanos para string "TRUE"/"FALSE"
      const payload = { ...editData };
      ["FIB","CEB_TEP_TIV","OFICIO_BAIXA","INUTILIZADO","RESTRICAO_ROUBO"].forEach(k => {
        if (k in payload) payload[k] = boolStr(payload[k]);
      });
      const res = await fetch(`/api/bens/${lista}/${row}`, {
        method:"PATCH",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Erro ao salvar");
      setBem(json.item);
      setEditMode(false);
      showToast("Alterações salvas com sucesso!");
    } catch(e) {
      showToast(e.message, "error");
    } finally {
      setSalvando(false);
    }
  };

  const handleTransicao = async (obs) => {
    setSalvando(true);
    const destino = modal === "HIGEIA" ? "pcdf2" : "catalogo";
    try {
      const res = await fetch("/api/bens/transicao", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ origem: lista, rowNumber: Number(row), destino, observacao: obs }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Erro na transição");
      setModal(null);
      if (destino === "pcdf2") {
        showToast(`Bem movido para PCDF 2ª HIGEIA com sucesso!`);
        setTimeout(()=>router.push("/gestao"), 2000);
      } else {
        setBem(json.item);
        showToast(`DESTINACAO atualizada para CATÁLOGO!`);
      }
    } catch(e) {
      showToast(e.message, "error");
    } finally {
      setSalvando(false);
    }
  };

  const upd = (field, val) => setEditData(prev=>({ ...prev, [field]:val }));
  const current = editMode ? editData : bem;

  const idDisplay = displayId(current, listaKey);
  const status    = STATUS_META[current?.STATUS_DILIGENCIA] || STATUS_META["AGUARDANDO"];
  const responsavel = nomeResp(current);

  // ── Loading ──
  if (!lista || !row) {
    return (
      <div className="signu-layout" style={{ background:"#060f1e", fontFamily:"'Inter',system-ui,sans-serif", color:"#e2e8f0" }}>
        <Sidebar/>
        <main style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16 }}>
          <div style={{ fontSize:40 }}>📋</div>
          <div style={{ fontSize:16,color:"rgba(255,255,255,0.5)" }}>Nenhum bem selecionado.</div>
          <button onClick={()=>router.push("/gestao")} style={{ padding:"8px 20px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:8,color:"#c9a84c",fontSize:13,cursor:"pointer",fontWeight:600 }}>← Ir para Gestão</button>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="signu-layout" style={{ background:"#060f1e", fontFamily:"'Inter',system-ui,sans-serif", color:"#e2e8f0" }}>
        <Sidebar/>
        <main style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:16 }}>
          <Ico.Spinner color={meta.color} size={32}/>
          <span style={{ color:"rgba(255,255,255,0.4)" }}>Carregando bem…</span>
        </main>
      </div>
    );
  }

  if (erroLoad || !bem) {
    return (
      <div className="signu-layout" style={{ background:"#060f1e", fontFamily:"'Inter',system-ui,sans-serif", color:"#e2e8f0" }}>
        <Sidebar/>
        <main style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12 }}>
          <div style={{ fontSize:40 }}>⚠️</div>
          <div style={{ fontSize:14,color:"#f87171" }}>{erroLoad || "Item não encontrado"}</div>
          <button onClick={()=>router.push("/gestao")} style={{ padding:"8px 20px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:8,color:"#c9a84c",fontSize:13,cursor:"pointer",fontWeight:600 }}>← Voltar para Gestão</button>
        </main>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.2);border-radius:4px}
        select option{background:#0a1628}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>

      <div className="signu-layout" style={{ background:"#060f1e", fontFamily:"'Inter',system-ui,sans-serif", color:"#e2e8f0" }}>
        <Sidebar/>

        <main className="signu-main">

          {/* Top bar */}
          <header style={{ height:56,borderBottom:"1px solid rgba(201,168,76,0.1)",background:"#0a1628",display:"flex",alignItems:"center",padding:"0 24px",gap:12,flexShrink:0 }}>
            <button onClick={()=>router.back()} style={{ display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"5px 10px",color:"rgba(255,255,255,0.5)",fontSize:12,cursor:"pointer" }}>
              <Ico.Back/> Voltar
            </button>
            <span style={{ color:"rgba(255,255,255,0.15)" }}>/</span>
            <span style={{ fontSize:13,color:"rgba(255,255,255,0.5)" }}>Detalhes</span>
            <span style={{ fontSize:13,color:"rgba(255,255,255,0.2)" }}>/</span>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:meta.color }}>{idDisplay}</span>
            <div style={{ flex:1 }}/>
            {salvando && <Ico.Spinner color={meta.color} size={16}/>}
            {!editMode ? (
              <button onClick={handleEdit} style={{ display:"flex",alignItems:"center",gap:6,background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:6,padding:"6px 14px",color:"#c9a84c",fontSize:12,fontWeight:600,cursor:"pointer" }}>
                <Ico.Edit/> Editar
              </button>
            ) : (
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={()=>setEditMode(false)} disabled={salvando} style={{ display:"flex",alignItems:"center",gap:6,background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"6px 12px",color:"rgba(255,255,255,0.5)",fontSize:12,cursor:"pointer" }}>
                  <Ico.Cancel/> Cancelar
                </button>
                <button onClick={handleSave} disabled={salvando} style={{ display:"flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#15803d,#22c55e)",border:"none",borderRadius:6,padding:"6px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer" }}>
                  <Ico.Save/> {salvando?"Salvando…":"Salvar"}
                </button>
              </div>
            )}
          </header>

          <div style={{ flex:1,overflow:"auto",display:"flex",flexDirection:"column" }}>

            {/* Hero header */}
            <div style={{ padding:"24px 28px 0",background:"linear-gradient(180deg,rgba(10,22,40,0.8) 0%,transparent 100%)" }}>
              <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:16,marginBottom:20 }}>
                <div style={{ display:"flex",alignItems:"center",gap:16 }}>
                  <div style={{ width:56,height:56,borderRadius:12,background:`linear-gradient(135deg,${meta.bg},rgba(6,15,30,0.8))`,border:`1px solid ${meta.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26 }}>
                    {TIPO_ICON[current?.TIPO_BEM] || "📦"}
                  </div>
                  <div>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap" }}>
                      <span style={{ fontSize:11,fontWeight:700,color:meta.color,background:meta.bg,padding:"3px 10px",borderRadius:4,letterSpacing:"0.06em" }}>{meta.label}</span>
                      <span style={{ fontSize:11,fontWeight:600,color:status.color,background:status.bg,padding:"3px 10px",borderRadius:20,border:`1px solid ${status.color}33` }}>
                        {current?.STATUS_DILIGENCIA || "—"}
                      </span>
                    </div>
                    <h1 style={{ fontSize:20,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em" }}>
                      {current?.TIPO_BEM || "Bem"} — {current?.ID_PASEI || "—"}
                    </h1>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:3 }}>
                      NIV: {current?.NIV || "—"} · Responsável: {responsavel || "—"}
                    </div>
                  </div>
                </div>

                {/* Botões de transição — apenas CEGOC, fora do modo edição */}
                {listaKey === "CEGOC" && !editMode && (
                  <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
                    {current?.DESTINACAO === "EM DILIGÊNCIA HIGEIA" && (
                      <button onClick={()=>setModal("HIGEIA")} style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 18px",borderRadius:10,background:"linear-gradient(135deg,rgba(29,78,216,0.2),rgba(59,130,246,0.1))",border:"1px solid rgba(59,130,246,0.5)",color:"#60a5fa",fontSize:13,fontWeight:700,cursor:"pointer" }}>
                        🏛️ Mover → PCDF 2ª <Ico.Arrow/>
                      </button>
                    )}
                    {current?.DESTINACAO === "LPC" && (
                      <button onClick={()=>setModal("CATALOGO")} style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 18px",borderRadius:10,background:"linear-gradient(135deg,rgba(21,128,61,0.2),rgba(34,197,94,0.1))",border:"1px solid rgba(34,197,94,0.5)",color:"#22c55e",fontSize:13,fontWeight:700,cursor:"pointer" }}>
                        📋 LPC → Catálogo <Ico.Arrow/>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display:"flex",gap:0,borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                {[["dados","📋 Dados"],["historico","🕐 Histórico"],["anexos","📎 Anexos"]].map(([id,label])=>(
                  <button key={id} onClick={()=>setActiveTab(id)} style={{ padding:"10px 20px",fontSize:13,fontWeight:activeTab===id?600:400,color:activeTab===id?"#c9a84c":"rgba(255,255,255,0.4)",background:"transparent",border:"none",borderBottom:activeTab===id?"2px solid #c9a84c":"2px solid transparent",cursor:"pointer",transition:"all 0.15s" }}>{label}</button>
                ))}
              </div>
            </div>

            {/* TAB: DADOS */}
            {activeTab==="dados" && (
              <div style={{ padding:"24px 28px 40px",display:"grid",gridTemplateColumns:"1fr 320px",gap:20 }}>

                {/* Coluna principal */}
                <div style={{ display:"flex",flexDirection:"column",gap:16 }}>

                  <Section title="Identificação">
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
                      <FieldView label="ID_PASEI" value={current?.ID_PASEI} mono highlight="#c9a84c"/>
                      <FieldView label="ID Legado" value={idDisplay} mono/>
                      {editMode
                        ? <FieldEdit label="Tipo de Bem" value={editData?.TIPO_BEM} onChange={v=>upd("TIPO_BEM",v)} options={TIPOS_BEM}/>
                        : <FieldView label="Tipo de Bem" value={current?.TIPO_BEM}/>}
                      {editMode
                        ? <FieldEdit label="Status" value={editData?.STATUS_DILIGENCIA} onChange={v=>upd("STATUS_DILIGENCIA",v)} options={STATUS_OPTIONS}/>
                        : <FieldView label="Status" value={current?.STATUS_DILIGENCIA}/>}
                      {editMode
                        ? <FieldEdit label="NIV / Chassi" value={editData?.NIV} onChange={v=>upd("NIV",v)} mono/>
                        : <FieldView label="NIV / Chassi" value={current?.NIV} mono/>}
                      {editMode
                        ? <FieldEdit label="Destinação" value={editData?.DESTINACAO} onChange={v=>upd("DESTINACAO",v)} options={DESTINACOES}/>
                        : <FieldView label="Destinação" value={current?.DESTINACAO}/>}
                    </div>
                  </Section>

                  <Section title="Responsável">
                    {editMode ? (
                      <FieldEdit label="Nome do Servidor" value={editData?.RESPONSAVEL||editData?.Responsavel||""} onChange={v=>upd("RESPONSAVEL",v)}/>
                    ) : (
                      <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                        <div style={{ width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#1e40af,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0 }}>
                          {responsavel ? responsavel.split(" ").map(w=>w[0]).slice(0,2).join("") : "?"}
                        </div>
                        <div>
                          <div style={{ fontSize:13,fontWeight:600,color:"#fff" }}>{responsavel || "—"}</div>
                        </div>
                      </div>
                    )}
                  </Section>

                  {/* Campos condicionais CEGOC */}
                  {listaKey==="CEGOC" && (
                    <Section title="Campos CEGOC">
                      <Toggle label="FIB Expedida" value={editMode?editData?.FIB:current?.FIB} onChange={v=>upd("FIB",v)} editMode={editMode}/>
                    </Section>
                  )}

                  {/* Campos condicionais PCDF 2ª */}
                  {listaKey==="PCDF_2HIGEIA" && (
                    <Section title="Campos PCDF 2ª HIGEIA">
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8 }}>
                        {editMode
                          ? <FieldEdit label="Depósito" value={editData?.DEPOSITO} onChange={v=>upd("DEPOSITO",v)} options={DEPOSITOS}/>
                          : <FieldView label="Depósito" value={current?.DEPOSITO}/>}
                        {editMode
                          ? <FieldEdit label="PA TJDFT" value={editData?.PA_TJDFT} onChange={v=>upd("PA_TJDFT",v)}/>
                          : <FieldView label="PA TJDFT" value={current?.PA_TJDFT}/>}
                        <FieldView label="Origem CEGOC ID" value={current?.ORIGEM_CEGOC_ID} mono/>
                        {editMode
                          ? <FieldEdit label="Peso (kg)" value={editData?.PESO_KG} onChange={v=>upd("PESO_KG",v)} type="number"/>
                          : <FieldView label="Peso (kg)" value={current?.PESO_KG?`${current.PESO_KG} kg`:null}/>}
                      </div>
                      {[["FIB Expedida","FIB"],["CEB/TEP/TIV Emitido","CEB_TEP_TIV"],["Ofício de Baixa","OFICIO_BAIXA"],["Inutilizado","INUTILIZADO"],["Restrição Roubo/Furto","RESTRICAO_ROUBO"]].map(([label,field])=>(
                        <Toggle key={field} label={label} value={editMode?editData?.[field]:current?.[field]} onChange={v=>upd(field,v)} editMode={editMode}/>
                      ))}
                    </Section>
                  )}

                  {/* Campos condicionais DPJ */}
                  {listaKey==="DPJ_GC99" && (
                    <Section title="Campos DPJ-GC99">
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
                        <FieldView label="Lote" value={current?.LOTE?`#${current.LOTE}`:null}/>
                        <FieldView label="PA PJE" value={current?.PA_PJE} mono/>
                        <FieldView label="Data de Entrada" value={current?.DATA_ENTRADA}/>
                        <FieldView label="Prazo 6 Meses" value={current?.PRAZO_6MESES} highlight="#fbbf24"/>
                        {editMode
                          ? <FieldEdit label="Motivo de Saída" value={editData?.MOTIVO_SAIDA||""} onChange={v=>upd("MOTIVO_SAIDA",v)} options={["","DETERIORADO","BAIXA","DOAÇÃO","ARREMATAÇÃO LPC"]}/>
                          : <FieldView label="Motivo de Saída" value={current?.MOTIVO_SAIDA}/>}
                      </div>
                    </Section>
                  )}

                  {/* Observações */}
                  <Section title="Observações">
                    {editMode ? (
                      <textarea value={editData?.OBSERVACOES||""} onChange={e=>upd("OBSERVACOES",e.target.value)}
                        style={{ width:"100%",minHeight:100,padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:8,color:"rgba(255,255,255,0.8)",fontSize:13,lineHeight:1.6,resize:"vertical",outline:"none" }}/>
                    ) : (
                      <p style={{ fontSize:13,color:"rgba(255,255,255,0.65)",lineHeight:1.7,margin:0 }}>{current?.OBSERVACOES || <span style={{ fontStyle:"italic",color:"rgba(255,255,255,0.2)" }}>Sem observações.</span>}</p>
                    )}
                  </Section>
                </div>

                {/* Coluna lateral */}
                <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
                  <Section title="Metadados">
                    <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                      <FieldView label="Lista de Origem">
                        <span style={{ fontSize:12,fontWeight:700,color:meta.color,background:meta.bg,padding:"3px 10px",borderRadius:4 }}>{meta.label}</span>
                      </FieldView>
                      <FieldView label="Linha na Planilha" value={`#${current?._rowNumber}`} mono/>
                      <FieldView label="Data de Cadastro"  value={current?.DATA_CADASTRO||"—"}/>
                      <FieldView label="Última Atualização" value={current?.DATA_ATUALIZACAO||"—"}/>
                    </div>
                  </Section>

                  <Section title="Rota API SIGNU">
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"rgba(255,255,255,0.35)",lineHeight:2 }}>
                      <div><span style={{ color:"#22c55e" }}>GET</span> /api/bens/{lista}/{row}</div>
                      <div><span style={{ color:"#fbbf24" }}>PATCH</span> /api/bens/{lista}/{row}</div>
                      <div><span style={{ color:"#3b82f6" }}>POST</span> /api/bens/transicao</div>
                    </div>
                  </Section>
                </div>
              </div>
            )}

            {/* TAB: HISTÓRICO */}
            {activeTab==="historico" && (() => {
              const historico = parseHistorico(bem, listaKey);
              return (
                <div style={{ padding:"28px 32px 40px",maxWidth:680 }}>
                  {historico.length === 0 ? (
                    <div style={{ textAlign:"center",padding:"48px 0",color:"rgba(255,255,255,0.25)",fontSize:13,fontStyle:"italic" }}>
                      Nenhum histórico disponível. Preencha DATA_CADASTRO ou realize uma transição para gerar entradas.
                    </div>
                  ) : (
                    <div style={{ display:"flex",flexDirection:"column",gap:0 }}>
                      {historico.map((h, i) => (
                        <div key={i} style={{ display:"flex",gap:16,paddingBottom:24,position:"relative" }}>
                          {/* Linha vertical */}
                          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,width:28 }}>
                            <div style={{ width:28,height:28,borderRadius:"50%",background:`${h.cor}20`,border:`2px solid ${h.cor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0 }}>{h.icon}</div>
                            {i < historico.length - 1 && <div style={{ width:2,flex:1,background:`${h.cor}25`,marginTop:6 }}/>}
                          </div>
                          {/* Conteúdo */}
                          <div style={{ paddingBottom:8,flex:1 }}>
                            <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:4,fontFamily:"'IBM Plex Mono',monospace" }}>{h.data}</div>
                            <div style={{ fontSize:13,fontWeight:600,color:"#fff",marginBottom:h.detalhe?4:0,lineHeight:1.4 }}>{h.acao}</div>
                            {h.detalhe && <div style={{ fontSize:11,color:"rgba(255,255,255,0.4)" }}>{h.detalhe}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop:8,padding:"10px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,fontSize:11,color:"rgba(255,255,255,0.25)" }}>
                    💡 Entradas de histórico são geradas automaticamente pelas transições de estado e ficam registradas no campo OBSERVACOES da planilha.
                  </div>
                </div>
              );
            })()}

            {/* TAB: ANEXOS */}
            {activeTab==="anexos" && (
              <div style={{ padding:"28px 32px 40px",maxWidth:680 }}>
                {/* Dropzone */}
                <div
                  onDragOver={e=>{e.preventDefault();setArrastando(true);}}
                  onDragLeave={()=>setArrastando(false)}
                  onDrop={e=>{e.preventDefault();setArrastando(false);addFiles(e.dataTransfer.files);}}
                  onClick={()=>!uploadando&&fileInputRef.current?.click()}
                  style={{
                    border:`2px dashed ${arrastando?"rgba(201,168,76,0.6)":"rgba(201,168,76,0.2)"}`,
                    borderRadius:12, padding:"36px 20px", textAlign:"center", marginBottom:20,
                    background:arrastando?"rgba(201,168,76,0.06)":"rgba(201,168,76,0.02)",
                    cursor:uploadando?"not-allowed":"pointer", transition:"all 0.2s",
                  }}>
                  <div style={{ fontSize:32,marginBottom:10 }}>
                    {uploadando ? <Ico.Spinner color="#c9a84c" size={32}/> : arrastando ? "⬇️" : "📎"}
                  </div>
                  <div style={{ fontSize:14,fontWeight:600,color:arrastando?"#c9a84c":"rgba(255,255,255,0.6)",marginBottom:6 }}>
                    {uploadando ? "Enviando para o Google Drive…" : arrastando ? "Solte para anexar" : "Arraste arquivos ou clique para selecionar"}
                  </div>
                  <div style={{ fontSize:12,color:"rgba(255,255,255,0.3)" }}>PDF, DOC, DOCX, JPG, PNG — máx. 20 MB por arquivo</div>
                  <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    style={{ display:"none" }} onChange={e=>{addFiles(e.target.files);e.target.value="";}}/>
                </div>

                {/* Lista de arquivos */}
                {carregandoAnexos ? (
                  <div style={{ textAlign:"center",padding:"24px 0",color:"rgba(255,255,255,0.3)",fontSize:13 }}>
                    <Ico.Spinner/> <span style={{ marginLeft:8 }}>Carregando anexos…</span>
                  </div>
                ) : anexos.length > 0 ? (
                  <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:20 }}>
                    <div style={{ fontSize:11,fontWeight:700,color:"rgba(201,168,76,0.7)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4 }}>
                      {anexos.length} arquivo{anexos.length!==1?"s":""} no Google Drive
                    </div>
                    {anexos.map(a => (
                      <div key={a.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"linear-gradient(145deg,#0f2040,#0a1628)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10 }}>
                        <span style={{ fontSize:22,flexShrink:0 }}>{fileIcon(a.tipo)}</span>
                        <div style={{ flex:1,minWidth:0 }}>
                          {a.url ? (
                            <a href={a.url} target="_blank" rel="noreferrer"
                              style={{ fontSize:13,fontWeight:500,color:"#c9a84c",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block",textDecoration:"none" }}>
                              {a.nome} ↗
                            </a>
                          ) : (
                            <div style={{ fontSize:13,fontWeight:500,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{a.nome}</div>
                          )}
                          <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2 }}>{fmtBytes(a.tamanho)} · {a.data}</div>
                        </div>
                        <span style={{ fontSize:10,background:"rgba(34,197,94,0.12)",color:"#22c55e",padding:"2px 8px",borderRadius:10,fontWeight:600,flexShrink:0 }}>Drive</span>
                        <button onClick={()=>removerAnexo(a.id)} title="Remover"
                          style={{ background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,color:"#f87171",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,flexShrink:0 }}>×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign:"center",padding:"24px 0",color:"rgba(255,255,255,0.25)",fontSize:13,fontStyle:"italic" }}>
                    Nenhum arquivo anexado. Arraste ou clique acima para adicionar.
                  </div>
                )}

                {/* Nota */}
                <div style={{ padding:"10px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,fontSize:11,color:"rgba(255,255,255,0.25)" }}>
                  ☁️ Arquivos armazenados no Google Drive (pasta SIGNU_Anexos). Clique no nome do arquivo para abrir.
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {modal && <TransicaoModal tipo={modal} bem={current} onClose={()=>setModal(null)} onConfirm={handleTransicao} salvando={salvando}/>}
      <Toast msg={toast.msg} type={toast.type}/>
    </>
  );
}

export default function DetalhesPage() {
  return (
    <Suspense fallback={
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#060f1e" }}>
        <div style={{ width:32, height:32, border:"2px solid rgba(201,168,76,0.2)", borderTop:"2px solid #c9a84c", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <DetalhesContent />
    </Suspense>
  );
}
