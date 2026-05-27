"use client";

import Sidebar from "@/components/Sidebar";

import { useState } from "react";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const mockBens = {
  "CEGOC-0142": {
    id: "CEGOC-0142", ID_PASEI: "0038491-22.2024.8.07.0001",
    TIPO_BEM: "CARRO", NIV: "9BWZZZ377VT004251",
    STATUS_DILIGENCIA: "EM DILIGÊNCIA", DESTINACAO: "EM DILIGÊNCIA HIGEIA",
    listaOrigem: "CEGOC", diasSemAtualizacao: 12, FIB: false,
    Responsavel: { DisplayName: "Carla Araújo", Email: "carla.araujo@tjdft.jus.br" },
    OBSERVACOES: "Veículo aguardando expedição FIB para transferência HIGEIA. Contato realizado com depósito em 15/05/2026.",
    DATA_CADASTRO: "2024-03-10", DATA_ATUALIZACAO: "2026-05-15",
  },
  "CEGOC-0087": {
    id: "CEGOC-0087", ID_PASEI: "0019273-55.2023.8.07.0015",
    TIPO_BEM: "MOTO", NIV: "9C2JC4110LR501234",
    STATUS_DILIGENCIA: "ATRASADO", DESTINACAO: "LPC",
    listaOrigem: "CEGOC", diasSemAtualizacao: 34, FIB: false,
    Responsavel: { DisplayName: "Carla Araújo", Email: "carla.araujo@tjdft.jus.br" },
    OBSERVACOES: "Pendente retorno do leiloeiro oficial. Aguardando confirmação de data do leilão LPC.",
    DATA_CADASTRO: "2023-11-20", DATA_ATUALIZACAO: "2026-04-23",
  },
  "PCDF2-0201": {
    id: "PCDF2-0201", ID_PASEI: "0071009-44.2024.8.07.0007",
    TIPO_BEM: "CAMINHÃO", NIV: "9BM379182LB755000",
    STATUS_DILIGENCIA: "EM DILIGÊNCIA", DESTINACAO: "CPA/PCDF",
    listaOrigem: "PCDF_2HIGEIA", diasSemAtualizacao: 19,
    RESTRICAO_ROUBO: true, PA_TJDFT: "N/C", ORIGEM_CEGOC_ID: "CEGOC-0099",
    FIB: false, CEB_TEP_TIV: false, OFICIO_BAIXA: false, INUTILIZADO: false,
    PESO_KG: 8500, DEPOSITO: "CPA/PCDF",
    Responsavel: { DisplayName: "Carla Araújo", Email: "carla.araujo@tjdft.jus.br" },
    OBSERVACOES: "Restrição roubo/furto ativa. Aguardando PA TJDFT para prosseguir com baixa.",
    DATA_CADASTRO: "2024-01-15", DATA_ATUALIZACAO: "2026-05-08",
  },
  "DPJ-0049": {
    id: "DPJ-0049", ID_PASEI: "0002341-88.2021.8.07.0020",
    TIPO_BEM: "CARRO", NIV: "1HGBH41JXMN109186",
    STATUS_DILIGENCIA: "PRAZO 6 MESES", DESTINACAO: "DETERIORADO",
    listaOrigem: "DPJ_GC99", diasSemAtualizacao: 8,
    LOTE: 49, PA_PJE: "0002341-88.2021",
    DATA_ENTRADA: "2025-11-28", PRAZO_6MESES: "2026-05-28",
    MOTIVO_SAIDA: null,
    Responsavel: { DisplayName: "Cláudia Santos", Email: "claudia.santos@tjdft.jus.br" },
    OBSERVACOES: "Prazo de 6 meses a vencer em 3 dias. Prioridade máxima.",
    DATA_CADASTRO: "2025-11-28", DATA_ATUALIZACAO: "2026-05-19",
  },
};

const SERVIDORES = [
  { DisplayName: "Carla Araújo",     Email: "carla.araujo@tjdft.jus.br" },
  { DisplayName: "Amanda Junqueira", Email: "amanda.junqueira@tjdft.jus.br" },
  { DisplayName: "Carlos Caetano",   Email: "carlos.caetano@tjdft.jus.br" },
  { DisplayName: "Cláudia Santos",   Email: "claudia.santos@tjdft.jus.br" },
  { DisplayName: "Loara Passo",      Email: "joyanna.passo@tjdft.jus.br" },
  { DisplayName: "Letícia Mota",     Email: "leticia.mota@tjdft.jus.br" },
  { DisplayName: "Marcelo Oliveira", Email: "marcelo.oliveira@tjdft.jus.br" },
];

const TIPOS_BEM   = ["CARRO","MOTO","CAMINHÃO","CAMINHONETE","REBOQUE","OUTROS"];
const DESTINACOES = ["EM DILIGÊNCIA HIGEIA","LPC","CATÁLOGO","RENAJUD","CIRCULAÇÃO","RECICLAGEM"];
const DEPOSITOS   = ["SELAB/PCDF","CPA/PCDF","CPA","CEGOC","5ªDP","23ªDP","30ªDP","33ªDP"];

const LISTA_META = {
  CEGOC:        { label: "CEGOC",     color: "#3b82f6", bg: "#1e3a5f" },
  PCDF_1HIGEIA: { label: "PCDF 1ª",  color: "#a78bfa", bg: "#3b1f5f" },
  PCDF_2HIGEIA: { label: "PCDF 2ª",  color: "#c084fc", bg: "#4a1f6f" },
  DPJ_GC99:     { label: "DPJ-GC99", color: "#fb923c", bg: "#5f2a0e" },
};

const STATUS_META = {
  "EM DILIGÊNCIA": { color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  "AGUARDANDO":    { color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  "ATRASADO":      { color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  "PRAZO 6 MESES": { color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  "BAIXADO":       { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const TIPO_ICON = { CARRO:"🚗", MOTO:"🏍️", CAMINHONETE:"🛻", CAMINHÃO:"🚛", REBOQUE:"🚜", OUTROS:"📦" };

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Ico = {
  Back: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  Edit: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Save: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Cancel: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Upload: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Alert: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Arrow: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  History: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  Home: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Queue: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="17" width="11" height="4" rx="1"/></svg>,
};

// ─── FIELD COMPONENTS ────────────────────────────────────────────────────────
function FieldView({ label, value, mono, highlight, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{label}</div>
      {children || (
        <div style={{
          fontSize: 13, fontFamily: mono ? "'IBM Plex Mono',monospace" : "inherit",
          color: highlight || "rgba(255,255,255,0.85)", fontWeight: 500, lineHeight: 1.4,
        }}>{value || <span style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>—</span>}</div>
      )}
    </div>
  );
}

function FieldEdit({ label, value, onChange, type = "text", options }) {
  const inputStyle = {
    width: "100%", padding: "8px 10px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(201,168,76,0.3)",
    borderRadius: 6, color: "#fff", fontSize: 13,
    outline: "none", boxSizing: "border-box",
  };
  return (
    <div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{label}</div>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
          {options.map(o => <option key={o} value={o} style={{ background: "#0a1628" }}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
      )}
    </div>
  );
}

function Toggle({ label, value, onChange, editMode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{label}</span>
      {editMode ? (
        <button onClick={() => onChange(!value)} style={{
          width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
          background: value ? "#22c55e" : "rgba(255,255,255,0.1)",
          position: "relative", transition: "background 0.2s",
        }}>
          <span style={{
            position: "absolute", top: 3, left: value ? 23 : 3,
            width: 18, height: 18, borderRadius: "50%", background: "#fff",
            transition: "left 0.2s",
          }}/>
        </button>
      ) : (
        <span style={{
          fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 12,
          color: value ? "#22c55e" : "rgba(255,255,255,0.3)",
          background: value ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
        }}>{value ? "✓ Sim" : "Não"}</span>
      )}
    </div>
  );
}

// ─── TRANSIÇÃO MODAL ──────────────────────────────────────────────────────────
function TransicaoModal({ tipo, bem, onClose, onConfirm }) {
  const [obs, setObs] = useState("");
  const isHigeia  = tipo === "HIGEIA";
  const isCatalogo = tipo === "CATALOGO";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}/>
      <div style={{
        position: "relative", width: 460,
        background: "linear-gradient(145deg, #0f2040, #0a1628)",
        border: "1px solid rgba(201,168,76,0.25)", borderRadius: 16,
        padding: 28, zIndex: 1,
      }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Confirmar Transição
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>
          {isHigeia ? "🏛️ Mover para PCDF 2ª HIGEIA" : "📋 Concluir LPC → CATÁLOGO"}
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 20px", lineHeight: 1.5 }}>
          {isHigeia
            ? `O bem ${bem.id} será criado em Bens_PCDF_2HIGEIA e removido de Bens_CEGOC. O canal NULEJ será notificado.`
            : `O campo DESTINACAO será alterado para CATÁLOGO. O item permanece em Bens_CEGOC.`}
        </p>

        {/* Resumo do bem */}
        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10, padding: "12px 14px", marginBottom: 20,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px",
        }}>
          {[["ID_PASEI", bem.ID_PASEI], ["Tipo", bem.TIPO_BEM], ["NIV", bem.NIV], ["Destino atual", bem.DESTINACAO]].map(([l, v]) => (
            <div key={l}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "'IBM Plex Mono',monospace" }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            Observação da Transição *
          </div>
          <textarea
            value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Descreva o motivo da transição..."
            style={{
              width: "100%", minHeight: 80, padding: "10px 12px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,168,76,0.3)",
              borderRadius: 8, color: "#fff", fontSize: 13, resize: "vertical",
              outline: "none", lineHeight: 1.5, boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "11px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer",
          }}>Cancelar</button>
          <button
            onClick={() => obs.trim() && onConfirm(obs)}
            style={{
              flex: 2, padding: "11px", borderRadius: 8, border: "none", cursor: obs.trim() ? "pointer" : "not-allowed",
              background: obs.trim()
                ? (isHigeia ? "linear-gradient(135deg,#1d4ed8,#3b82f6)" : "linear-gradient(135deg,#15803d,#22c55e)")
                : "rgba(255,255,255,0.06)",
              color: obs.trim() ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 13, fontWeight: 700, transition: "all 0.2s",
            }}
          >{isHigeia ? "✓ Confirmar Migração" : "✓ Confirmar Transição"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const isSuccess = type === "success";
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 200,
      display: "flex", alignItems: "center", gap: 10,
      padding: "14px 20px", borderRadius: 12,
      background: isSuccess ? "linear-gradient(135deg,#15803d,#166534)" : "linear-gradient(135deg,#991b1b,#7f1d1d)",
      border: `1px solid ${isSuccess ? "rgba(34,197,94,0.4)" : "rgba(248,113,113,0.4)"}`,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      fontSize: 14, fontWeight: 600, color: "#fff",
      animation: "slideUp 0.3s ease",
    }}>
      {isSuccess ? "✅" : "❌"} {msg}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function DetalhesPage() {
  const [selectedId, setSelectedId] = useState("CEGOC-0142");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState(null);
  const [modal, setModal] = useState(null); // "HIGEIA" | "CATALOGO"
  const [toast, setToast] = useState({ msg: "", type: "" });
  const [activeTab, setActiveTab] = useState("dados"); // "dados" | "historico" | "anexos"
  const [showSelector, setShowSelector] = useState(true);

  const bem = editMode ? editData : mockBens[selectedId];
  const lista = LISTA_META[bem?.listaOrigem] || LISTA_META.CEGOC;
  const status = STATUS_META[bem?.STATUS_DILIGENCIA] || STATUS_META["AGUARDANDO"];
  const atrasado = bem?.diasSemAtualizacao > 30;

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  };

  const handleEdit = () => {
    setEditData({ ...mockBens[selectedId] });
    setEditMode(true);
  };

  const handleSave = () => {
    showToast("Alterações salvas com sucesso!");
    setEditMode(false);
  };

  const handleTransicao = (obs) => {
    showToast(
      modal === "HIGEIA"
        ? `${bem.id} movido para PCDF 2ª HIGEIA com sucesso!`
        : `${bem.id} — DESTINACAO atualizada para CATÁLOGO!`
    );
    setModal(null);
  };

  const upd = (field, val) => setEditData(prev => ({ ...prev, [field]: val }));

  if (!bem) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.2); border-radius: 4px; }
        select option { background: #0a1628; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div style={{ display: "flex", height: "100vh", background: "#060f1e", fontFamily: "'Inter',system-ui,sans-serif", color: "#e2e8f0" }}>

        {/* ── SIDEBAR ── */}
      <Sidebar />

        {/* ── MAIN ── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top bar */}
          <header style={{ height: 56, borderBottom: "1px solid rgba(201,168,76,0.1)", background: "#0a1628", display: "flex", alignItems: "center", padding: "0 24px", gap: 12, flexShrink: 0 }}>
            <button onClick={() => setShowSelector(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "5px 10px", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>
              <Ico.Back/> Minha Fila
            </button>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>/</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Detalhes</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", margin: "0 2px" }}>/</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: lista.color }}>{bem.id}</span>
            <div style={{ flex: 1 }}/>
            {/* Edit / Save / Cancel */}
            {!editMode ? (
              <button onClick={handleEdit} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 6, padding: "6px 14px", color: "#c9a84c", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Ico.Edit/> Editar
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditMode(false)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 12px", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>
                  <Ico.Cancel/> Cancelar
                </button>
                <button onClick={handleSave} style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#15803d,#22c55e)", border: "none", borderRadius: 6, padding: "6px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  <Ico.Save/> Salvar
                </button>
              </div>
            )}
          </header>

          <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>

            {/* ── BEM SELECTOR (demo) ── */}
            {showSelector && (
              <div style={{ background: "rgba(201,168,76,0.06)", borderBottom: "1px solid rgba(201,168,76,0.12)", padding: "10px 24px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>DEMO — Selecionar bem:</span>
                {Object.values(mockBens).map(b => {
                  const lm = LISTA_META[b.listaOrigem];
                  return (
                    <button key={b.id} onClick={() => { setSelectedId(b.id); setEditMode(false); setShowSelector(false); }} style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${lm?.color || "#c9a84c"}55`,
                      background: selectedId === b.id ? lm?.bg : "transparent",
                      color: lm?.color || "#c9a84c",
                    }}>{b.id}</button>
                  );
                })}
              </div>
            )}

            {/* ── HERO HEADER ── */}
            <div style={{
              padding: "24px 28px 0",
              background: "linear-gradient(180deg, rgba(10,22,40,0.8) 0%, transparent 100%)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 12,
                    background: `linear-gradient(135deg, ${lista.bg}, rgba(6,15,30,0.8))`,
                    border: `1px solid ${lista.color}44`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
                  }}>{TIPO_ICON[bem.TIPO_BEM] || "📦"}</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: lista.color,
                        background: lista.bg, padding: "3px 10px", borderRadius: 4, letterSpacing: "0.06em",
                      }}>{lista.label}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: status.color,
                        background: status.bg, padding: "3px 10px", borderRadius: 20,
                        border: `1px solid ${status.color}33`,
                      }}>{bem.STATUS_DILIGENCIA}</span>
                      {atrasado && (
                        <span style={{
                          display: "flex", alignItems: "center", gap: 4,
                          fontSize: 11, fontWeight: 700, color: "#f87171",
                          background: "rgba(248,113,113,0.1)", padding: "3px 10px", borderRadius: 20,
                          border: "1px solid rgba(248,113,113,0.3)",
                        }}><Ico.Alert/> {bem.diasSemAtualizacao} dias sem atualização</span>
                      )}
                    </div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
                      {bem.TIPO_BEM} — {bem.ID_PASEI}
                    </h1>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
                      NIV: {bem.NIV || "—"} · Responsável: {bem.Responsavel?.DisplayName}
                    </div>
                  </div>
                </div>

                {/* Transição buttons — CEGOC only */}
                {bem.listaOrigem === "CEGOC" && !editMode && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {bem.DESTINACAO === "EM DILIGÊNCIA HIGEIA" && (
                      <button onClick={() => setModal("HIGEIA")} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 18px", borderRadius: 10,
                        background: "linear-gradient(135deg,rgba(29,78,216,0.2),rgba(59,130,246,0.1))",
                        border: "1px solid rgba(59,130,246,0.5)", color: "#60a5fa",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                      }}>
                        🏛️ Mover → PCDF 2ª <Ico.Arrow/>
                      </button>
                    )}
                    {bem.DESTINACAO === "LPC" && (
                      <button onClick={() => setModal("CATALOGO")} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 18px", borderRadius: 10,
                        background: "linear-gradient(135deg,rgba(21,128,61,0.2),rgba(34,197,94,0.1))",
                        border: "1px solid rgba(34,197,94,0.5)", color: "#22c55e",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                      }}>
                        📋 LPC → Catálogo <Ico.Arrow/>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {[["dados","📋 Dados"], ["historico","🕐 Histórico"], ["anexos","📎 Anexos"]].map(([id, label]) => (
                  <button key={id} onClick={() => setActiveTab(id)} style={{
                    padding: "10px 20px", fontSize: 13, fontWeight: activeTab === id ? 600 : 400,
                    color: activeTab === id ? "#c9a84c" : "rgba(255,255,255,0.4)",
                    background: "transparent", border: "none",
                    borderBottom: activeTab === id ? "2px solid #c9a84c" : "2px solid transparent",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {/* ── TAB: DADOS ── */}
            {activeTab === "dados" && (
              <div style={{ padding: "24px 28px 40px", display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>

                {/* Coluna principal */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Campos comuns */}
                  <Section title="Identificação">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <FieldView label="ID_PASEI" value={bem.ID_PASEI} mono highlight="#c9a84c"/>
                      <FieldView label="ID Legado" value={bem.id} mono/>
                      {editMode
                        ? <FieldEdit label="Tipo de Bem" value={editData.TIPO_BEM} onChange={v => upd("TIPO_BEM", v)} options={TIPOS_BEM}/>
                        : <FieldView label="Tipo de Bem" value={bem.TIPO_BEM}/>}
                      {editMode
                        ? <FieldEdit label="Status" value={editData.STATUS_DILIGENCIA} onChange={v => upd("STATUS_DILIGENCIA", v)} options={Object.keys(STATUS_META)}/>
                        : <FieldView label="Status" value={bem.STATUS_DILIGENCIA}/>}
                      <FieldView label="NIV / Chassi" value={bem.NIV} mono/>
                      {editMode
                        ? <FieldEdit label="Destinação" value={editData.DESTINACAO} onChange={v => upd("DESTINACAO", v)} options={DESTINACOES}/>
                        : <FieldView label="Destinação" value={bem.DESTINACAO}/>}
                    </div>
                  </Section>

                  {/* Responsável */}
                  <Section title="Responsável">
                    {editMode ? (
                      <FieldEdit label="Servidor Responsável" value={editData.Responsavel?.DisplayName}
                        onChange={v => { const s = SERVIDORES.find(x => x.DisplayName === v); if (s) upd("Responsavel", s); }}
                        options={SERVIDORES.map(s => s.DisplayName)}/>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#1e40af,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {bem.Responsavel?.DisplayName?.split(" ").map(w => w[0]).slice(0,2).join("")}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{bem.Responsavel?.DisplayName}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{bem.Responsavel?.Email}</div>
                        </div>
                      </div>
                    )}
                  </Section>

                  {/* Campos condicionais CEGOC */}
                  {bem.listaOrigem === "CEGOC" && (
                    <Section title="Campos CEGOC">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Toggle label="FIB Expedida" value={editMode ? editData.FIB : bem.FIB} onChange={v => upd("FIB", v)} editMode={editMode}/>
                      </div>
                    </Section>
                  )}

                  {/* Campos condicionais PCDF 2ª */}
                  {bem.listaOrigem === "PCDF_2HIGEIA" && (
                    <Section title="Campos PCDF 2ª HIGEIA">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
                        {editMode
                          ? <FieldEdit label="Depósito" value={editData.DEPOSITO} onChange={v => upd("DEPOSITO", v)} options={DEPOSITOS}/>
                          : <FieldView label="Depósito" value={bem.DEPOSITO}/>}
                        {editMode
                          ? <FieldEdit label="PA TJDFT" value={editData.PA_TJDFT} onChange={v => upd("PA_TJDFT", v)}/>
                          : <FieldView label="PA TJDFT" value={bem.PA_TJDFT}/>}
                        <FieldView label="Origem CEGOC ID" value={bem.ORIGEM_CEGOC_ID} mono/>
                        {editMode
                          ? <FieldEdit label="Peso (kg)" value={editData.PESO_KG} onChange={v => upd("PESO_KG", v)} type="number"/>
                          : <FieldView label="Peso (kg)" value={bem.PESO_KG ? `${bem.PESO_KG} kg` : null}/>}
                      </div>
                      {[
                        ["FIB Expedida", "FIB"],
                        ["CEB/TEP/TIV Emitido", "CEB_TEP_TIV"],
                        ["Ofício de Baixa", "OFICIO_BAIXA"],
                        ["Inutilizado", "INUTILIZADO"],
                        ["Restrição Roubo/Furto", "RESTRICAO_ROUBO"],
                      ].map(([label, field]) => (
                        <Toggle key={field} label={label} value={editMode ? editData[field] : bem[field]}
                          onChange={v => upd(field, v)} editMode={editMode}/>
                      ))}
                    </Section>
                  )}

                  {/* Campos condicionais DPJ */}
                  {bem.listaOrigem === "DPJ_GC99" && (
                    <Section title="Campos DPJ-GC99">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <FieldView label="Lote" value={bem.LOTE ? `#${bem.LOTE}` : null}/>
                        <FieldView label="PA PJE" value={bem.PA_PJE} mono/>
                        <FieldView label="Data de Entrada" value={bem.DATA_ENTRADA}/>
                        <FieldView label="Prazo 6 Meses" value={bem.PRAZO_6MESES} highlight="#fbbf24"/>
                        {editMode
                          ? <FieldEdit label="Motivo de Saída" value={editData.MOTIVO_SAIDA || ""} onChange={v => upd("MOTIVO_SAIDA", v)}
                              options={["","DETERIORADO","BAIXA","DOAÇÃO","ARREMATAÇÃO LPC"]}/>
                          : <FieldView label="Motivo de Saída" value={bem.MOTIVO_SAIDA}/>}
                      </div>
                    </Section>
                  )}

                  {/* Observações */}
                  <Section title="Observações">
                    {editMode ? (
                      <textarea value={editData.OBSERVACOES} onChange={e => upd("OBSERVACOES", e.target.value)}
                        style={{
                          width: "100%", minHeight: 100, padding: "10px 12px",
                          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,168,76,0.25)",
                          borderRadius: 8, color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 1.6,
                          resize: "vertical", outline: "none",
                        }}/>
                    ) : (
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, margin: 0 }}>{bem.OBSERVACOES}</p>
                    )}
                  </Section>
                </div>

                {/* Coluna lateral */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Metadados */}
                  <Section title="Metadados">
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <FieldView label="Lista de Origem">
                        <span style={{ fontSize: 12, fontWeight: 700, color: lista.color, background: lista.bg, padding: "3px 10px", borderRadius: 4 }}>{lista.label}</span>
                      </FieldView>
                      <FieldView label="Data de Cadastro" value={bem.DATA_CADASTRO}/>
                      <FieldView label="Última Atualização" value={bem.DATA_ATUALIZACAO}/>
                      <FieldView label="Dias sem atualização">
                        <span style={{ fontSize: 13, fontWeight: 700, color: atrasado ? "#f87171" : "rgba(255,255,255,0.7)" }}>
                          {atrasado && "⚠️ "}{bem.diasSemAtualizacao} dias
                        </span>
                      </FieldView>
                    </div>
                  </Section>

                  {/* API Info */}
                  <Section title="Rota API SIGNU">
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 2 }}>
                      <div><span style={{ color: "#22c55e" }}>GET</span> /api/bens/{bem.id}</div>
                      <div><span style={{ color: "#fbbf24" }}>PATCH</span> /api/bens/{bem.id}</div>
                      <div><span style={{ color: "#3b82f6" }}>POST</span> /api/bens/{bem.id}/transicao</div>
                      <div><span style={{ color: "#a78bfa" }}>POST</span> /api/bens/{bem.id}/anexos</div>
                    </div>
                  </Section>
                </div>
              </div>
            )}

            {/* ── TAB: HISTÓRICO ── */}
            {activeTab === "historico" && (
              <div style={{ padding: "28px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    { data: "2026-05-15 14:32", acao: "Observação atualizada", servidor: "Carla Araújo", cor: "#60a5fa" },
                    { data: "2026-04-10 09:15", acao: "Status alterado para EM DILIGÊNCIA", servidor: "Carla Araújo", cor: "#22c55e" },
                    { data: "2026-03-01 11:00", acao: "Responsável atribuído", servidor: "Sistema", cor: "#c9a84c" },
                    { data: "2024-03-10 08:00", acao: "Bem cadastrado no SIGNU", servidor: "Sistema", cor: "#a78bfa" },
                  ].map((h, i) => (
                    <div key={i} style={{ display: "flex", gap: 16, paddingBottom: 20, position: "relative" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: h.cor, marginTop: 4 }}/>
                        {i < 3 && <div style={{ width: 1, flex: 1, background: "rgba(255,255,255,0.06)", marginTop: 4 }}/>}
                      </div>
                      <div style={{ paddingBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 3 }}>{h.acao}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{h.data} · {h.servidor}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB: ANEXOS ── */}
            {activeTab === "anexos" && (
              <div style={{ padding: "28px" }}>
                <div style={{
                  border: "2px dashed rgba(201,168,76,0.2)", borderRadius: 12,
                  padding: "40px 20px", textAlign: "center", marginBottom: 20,
                  background: "rgba(201,168,76,0.03)",
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📎</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>Arraste arquivos aqui</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>PDF, DOC, DOCX, JPG, PNG</div>
                  <button style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 20px", borderRadius: 8,
                    background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)",
                    color: "#c9a84c", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}><Ico.Upload/> Selecionar arquivo</button>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
                  POST /api/bens/{bem.id}/anexos → SharePoint Drive
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal de Transição */}
      {modal && <TransicaoModal tipo={modal} bem={bem} onClose={() => setModal(null)} onConfirm={handleTransicao}/>}

      {/* Toast */}
      <Toast msg={toast.msg} type={toast.type}/>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: "linear-gradient(145deg,#0f2040,#0a1628)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, padding: "18px 20px",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(201,168,76,0.7)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}