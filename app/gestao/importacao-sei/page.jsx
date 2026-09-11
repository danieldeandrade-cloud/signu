"use client";
import Sidebar from "@/components/Sidebar";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// Lista de destino (rota da API) -> label/cor. Mesmas rotas de app/cadastro/page.jsx.
const LISTA_META = {
  cegoc: { label: "CEGOC", color: "#3b82f6" },
  dpj: { label: "DPJ-GC99", color: "#fb923c" },
  pcdf1: { label: "PCDF 1ª HIGEIA", color: "#a78bfa" },
  pcdf2: { label: "PCDF 2ª HIGEIA", color: "#c084fc" },
  sei: { label: "Caixa SEI", color: "#fbbf24" },
};

// Listas onde procurar duplicidade (mesmo conjunto do cadastro)
const TODAS_LISTAS_ROTA = ["cegoc", "dpj", "pcdf1", "pcdf2", "doacoes_diligencia", "sei"];

const SERVIDORES = [
  "Carla Araújo", "Amanda Junqueira", "Carlos Caetano",
  "Cláudia Santos", "Loara Passo", "Letícia Mota", "Marcelo Oliveira",
];

function Campo({ label, value, onChange, mono }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <input
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", padding: "7px 9px", background: "#f9fafb",
          border: "1px solid #d1d5db", borderRadius: 7, fontSize: 12, color: "#0f172a", outline: "none",
          fontFamily: mono ? "'IBM Plex Mono',monospace" : "inherit",
        }}
      />
    </div>
  );
}

function CardImportacao({ item, onPromovido, onDescartado, showToast }) {
  const meta = LISTA_META[item.LISTA_DESTINO] || { label: item.LISTA_DESTINO, color: "#6b7280" };
  const [campos, setCampos] = useState(item.campos || {});
  const [salvando, setSalvando] = useState(false);
  const [duplicata, setDuplicata] = useState(null); // { encontrados: [...] } | "buscando" | null
  const upd = (k, v) => setCampos(prev => ({ ...prev, [k]: v }));

  const alertas = (item.ALERTAS || "").split(" ; ").filter(Boolean);
  const incertos = (item.CAMPOS_INCERTOS || "").split(" ; ").filter(Boolean);
  const confianca = Number(item.CONFIANCA || 0);

  const verificarDuplicidade = async () => {
    setDuplicata("buscando");
    const alvo = (campos.ID_PASEI || campos.PA_PJE || "").toUpperCase().replace(/\s/g, "");
    const nivAlvo = (campos.NIV || "").toUpperCase();
    const encontrados = [];
    await Promise.allSettled(TODAS_LISTAS_ROTA.map(async (rota) => {
      try {
        const res = await fetch(`/api/bens/${rota}`);
        const json = await res.json();
        (json.dados || []).forEach(row => {
          const pasei = (row.ID_PASEI || row.PA_PJE || "").toUpperCase().replace(/\s/g, "");
          const niv = (row.NIV || "").toUpperCase();
          if ((alvo && pasei === alvo) || (nivAlvo && nivAlvo.length > 5 && niv === nivAlvo)) {
            encontrados.push({ rota, item: row });
          }
        });
      } catch { /* ignora erro de rede de uma lista */ }
    }));
    setDuplicata({ encontrados });
  };

  const promover = async () => {
    if (!campos.RESPONSAVEL || campos.RESPONSAVEL === "__AUTO__") {
      showToast("Escolha um responsável antes de promover.", "error");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch(`/api/importacao-sei/${item._rowNumber}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "promover", campos }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Erro ao promover");
      showToast(`Promovido para ${meta.label}`);
      onPromovido(item._rowNumber);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSalvando(false);
    }
  };

  const descartar = async () => {
    if (!window.confirm(`Descartar o item do processo ${item.PROCESSO_SEI}? Fica marcado como descartado (não some do histórico).`)) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/importacao-sei/${item._rowNumber}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "descartar" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Erro ao descartar");
      onDescartado(item._rowNumber);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ background: "#fff", border: "1.5px solid #b0b8c4", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}44` }}>{meta.label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", fontFamily: "'IBM Plex Mono',monospace" }}>{item.PROCESSO_SEI || "—"}</span>
          {item.URL_SEI && <a href={item.URL_SEI} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563eb" }}>abrir no SEI ↗</a>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: confianca >= 0.8 ? "#22c55e" : confianca >= 0.5 ? "#f59e0b" : "#f87171" }}>
            confiança {(confianca * 100).toFixed(0)}%
          </span>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, color: item.INFOSEG === "TRUE" ? "#22c55e" : "#6b7280", background: item.INFOSEG === "TRUE" ? "rgba(34,197,94,0.1)" : "#f3f4f6" }}>
            {item.INFOSEG === "TRUE" ? "✓ INFOSEG" : "sem INFOSEG"}
          </span>
        </div>
      </div>

      {item.TEXTO_MARCADOR && (
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>Texto do marcador: <strong>{item.TEXTO_MARCADOR}</strong></div>
      )}

      {alertas.length > 0 && (
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#92400e" }}>
          {alertas.map((a, i) => <div key={i}>⚠️ {a}</div>)}
        </div>
      )}
      {incertos.length > 0 && (
        <div style={{ fontSize: 10, color: "#f87171", marginBottom: 12 }}>Campos incertos: {incertos.join(", ")}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {Object.keys(campos).filter(k => k !== "RESPONSAVEL").map(k => (
          <Campo key={k} label={k} value={campos[k]} onChange={v => upd(k, v)} mono={/NIV|PLACA|RENAVAM|ID_PASEI|PA_PJE/.test(k)} />
        ))}
        <div>
          <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Responsável *</div>
          <select value={campos.RESPONSAVEL === "__AUTO__" ? "" : (campos.RESPONSAVEL || "")} onChange={e => upd("RESPONSAVEL", e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "7px 9px", background: "#f9fafb", border: `1px solid ${!campos.RESPONSAVEL || campos.RESPONSAVEL === "__AUTO__" ? "#fca5a5" : "#d1d5db"}`, borderRadius: 7, fontSize: 12, color: "#0f172a", cursor: "pointer" }}>
            <option value="">— Selecione —</option>
            {SERVIDORES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {duplicata && duplicata !== "buscando" && (
        <div style={{ marginBottom: 12, fontSize: 11 }}>
          {duplicata.encontrados.length === 0 ? (
            <span style={{ color: "#22c55e" }}>✓ Sem duplicidade encontrada.</span>
          ) : (
            <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ color: "#dc2626", fontWeight: 700, marginBottom: 4 }}>⚠️ Já cadastrado em {duplicata.encontrados.length} lugar(es):</div>
              {duplicata.encontrados.map((d, i) => (
                <div key={i} style={{ color: "#7f1d1d" }}>{d.rota}: {d.item.ID_PASEI || d.item.PA_PJE} · {d.item.TIPO_BEM || ""}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={verificarDuplicidade} disabled={duplicata === "buscando"}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "transparent", color: "#4b5563", fontSize: 12, cursor: "pointer" }}>
          {duplicata === "buscando" ? "Verificando…" : "🔍 Verificar duplicidade"}
        </button>
        <button onClick={promover} disabled={salvando}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: salvando ? "#e5e7eb" : "#22c55e", color: "#0f172a", fontSize: 12, fontWeight: 700, cursor: salvando ? "not-allowed" : "pointer" }}>
          ✅ Promover para {meta.label}
        </button>
        <button onClick={descartar} disabled={salvando}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.08)", color: "#dc2626", fontSize: 12, cursor: "pointer" }}>
          🗑 Descartar
        </button>
      </div>
    </div>
  );
}

export default function ImportacaoSeiPage() {
  const router = useRouter();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [toast, setToast] = useState({ msg: "", type: "" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/importacao-sei?status=PENDENTE");
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Erro ao carregar");
      setItens(json.dados || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const remover = (rowNumber) => setItens(prev => prev.filter(i => i._rowNumber !== rowNumber));

  return (
    <div className="signu-layout" style={{ background: "#dde1e7", fontFamily: "'Inter',system-ui,sans-serif", color: "#111827", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ marginLeft: 220, padding: "28px 32px", maxWidth: 1100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <button onClick={() => router.push("/gestao")} style={{ width: 32, height: 32, borderRadius: 8, background: "#f3f4f6", border: "1.5px solid #b0b8c4", color: "#374151", cursor: "pointer" }}>←</button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>📥 Importação SEI — a revisar</h1>
        </div>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 20px 34px" }}>
          Itens extraídos automaticamente de processos do SEI. Confira os campos, escolha o responsável e promova para a lista real — ou descarte se não for o caso.
        </p>

        {loading && <div style={{ fontSize: 13, color: "#6b7280" }}>Carregando…</div>}
        {erro && (
          <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#f87171", marginBottom: 16 }}>
            ⚠️ {erro}
          </div>
        )}
        {!loading && !erro && itens.length === 0 && (
          <div style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic", textAlign: "center", padding: "40px 0" }}>
            Nenhum item pendente de revisão.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {itens.map(item => (
            <CardImportacao key={item._rowNumber} item={item} onPromovido={remover} onDescartado={remover} showToast={showToast} />
          ))}
        </div>
      </main>

      {toast.msg && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 200,
          padding: "14px 22px", borderRadius: 14,
          background: toast.type === "error" ? "linear-gradient(135deg,#b91c1c,#7f1d1d)" : "linear-gradient(135deg,#15803d,#166534)",
          border: `1px solid ${toast.type === "error" ? "rgba(248,113,113,0.4)" : "rgba(34,197,94,0.4)"}`,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)", fontSize: 14, fontWeight: 700, color: "#fff",
        }}>
          {toast.type === "error" ? "⚠️ " : "✅ "}{toast.msg}
        </div>
      )}
    </div>
  );
}
