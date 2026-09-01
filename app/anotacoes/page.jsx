"use client";
import Sidebar from "@/components/Sidebar";
import { useState, useEffect, useCallback } from "react";
import { useEntidades } from "@/lib/useEntidades";

const MOTIVOS = [
  "Falta de interesse",
  "Não respondeu ao contato",
  "Recusou o bem oferecido",
  "Sem capacidade de receber",
  "Endereço desatualizado / não localizada",
  "Entidade suspensa ou fechada",
  "Bem não adequado ao perfil da entidade",
  "Aguardando documentação",
  "Outro",
];

const MOTIVO_COLOR = {
  "Falta de interesse":                  { color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  "Não respondeu ao contato":            { color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  "Recusou o bem oferecido":             { color: "#fb923c", bg: "rgba(251,146,60,0.12)"  },
  "Sem capacidade de receber":           { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  "Endereço desatualizado / não localizada":{ color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  "Entidade suspensa ou fechada":        { color: "#f87171", bg: "rgba(248,113,113,0.15)" },
  "Bem não adequado ao perfil da entidade":{ color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  "Aguardando documentação":             { color: "#fbbf24", bg: "rgba(251,191,36,0.10)"  },
  "Outro":                               { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

function MotivoBadge({ motivo }) {
  const m = MOTIVO_COLOR[motivo] || MOTIVO_COLOR["Outro"];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
      color: m.color, background: m.bg, border: `1px solid ${m.color}33`,
      whiteSpace: "nowrap",
    }}>{motivo}</span>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 20, height: 20, border: "2px solid rgba(37,99,235,0.15)",
      borderTop: "2px solid #2563eb", borderRadius: "50%",
      animation: "spin 0.8s linear infinite", flexShrink: 0,
    }}/>
  );
}

// ─── MODAL DE NOVA ANOTAÇÃO ──────────────────────────────────────────────────
function NovaAnotacaoModal({ onClose, onSalvo }) {
  const ENTIDADES = useEntidades();
  const [form, setForm] = useState({ entidade: "", motivo: "", bemVinculado: "", observacoes: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSalvar = async () => {
    if (!form.entidade || !form.motivo) { setErro("Preencha entidade e motivo."); return; }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/anotacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Erro ao salvar");
      onSalvo(json.anotacao);
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "9px 12px",
    background: "#f3f4f6",
    border: "1px solid #d1d5db",
    borderRadius: 8, color: "#0f172a", fontSize: 13,
    outline: "none", boxSizing: "border-box",
    fontFamily: "'Inter', system-ui, sans-serif",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}/>
      <div style={{
        position: "relative", width: 520, maxHeight: "90vh", overflow: "auto",
        background: "#fff",
        border: "1px solid rgba(37,99,235,0.15)", borderRadius: 16, padding: 28, zIndex: 1,
      }}>
        <div style={{ fontSize: 11, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Nova Anotação
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 24px" }}>
          📝 Doação não realizada
        </h2>

        {/* Entidade */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
            Entidade *
          </label>
          <select value={form.entidade} onChange={e => set("entidade", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="" style={{ background: "#fff", color: "#111827" }}>— Selecione a entidade —</option>
            {ENTIDADES.map(e => <option key={e} value={e} style={{ background: "#fff", color: "#111827" }}>{e}</option>)}
          </select>
        </div>

        {/* Motivo */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
            Motivo *
          </label>
          <select value={form.motivo} onChange={e => set("motivo", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="" style={{ background: "#fff", color: "#111827" }}>— Selecione o motivo —</option>
            {MOTIVOS.map(m => <option key={m} value={m} style={{ background: "#fff", color: "#111827" }}>{m}</option>)}
          </select>
        </div>

        {/* Bem vinculado */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
            Bem vinculado (opcional)
          </label>
          <input
            type="text" value={form.bemVinculado} onChange={e => set("bemVinculado", e.target.value)}
            placeholder="Ex: CEGOC-0142 ou ID_PASEI"
            style={inputStyle}
          />
          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4, fontStyle: "italic" }}>
            ID do bem que foi oferecido à entidade
          </div>
        </div>

        {/* Observações */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
            Observações
          </label>
          <textarea
            value={form.observacoes} onChange={e => set("observacoes", e.target.value)}
            placeholder="Detalhes do contato, nome do responsável na entidade, próximos passos..."
            style={{ ...inputStyle, minHeight: 90, resize: "vertical", lineHeight: 1.6 }}
          />
        </div>

        {erro && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, fontSize: 12, color: "#f87171" }}>
            ⚠ {erro}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={salvando}
            style={{ flex: 1, padding: "11px", borderRadius: 8, border: "1px solid #d1d5db", background: "transparent", color: "#374151", fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={salvando || !form.entidade || !form.motivo}
            style={{
              flex: 2, padding: "11px", borderRadius: 8, border: "none",
              background: salvando || !form.entidade || !form.motivo
                ? "#e5e7eb"
                : "linear-gradient(135deg, rgba(37,99,235,0.25), rgba(37,99,235,0.12))",
              color: salvando || !form.entidade || !form.motivo ? "#6b7280" : "#2563eb",
              fontSize: 13, fontWeight: 700, cursor: salvando || !form.entidade || !form.motivo ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            {salvando ? <><Spinner size={14}/> Salvando…</> : "✓ Salvar Anotação"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function AnotacoesPage() {
  const [anotacoes, setAnotacoes]       = useState([]);
  const [carregando, setCarregando]     = useState(true);
  const [modalAberto, setModalAberto]   = useState(false);
  const [filtroEntidade, setFiltroEntidade] = useState("");
  const [filtroMotivo, setFiltroMotivo]    = useState("TODOS");
  const [busca, setBusca]               = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/anotacoes");
      const json = await res.json();
      setAnotacoes((json.dados || []).reverse()); // mais recente primeiro
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleSalvo = (nova) => {
    setAnotacoes(prev => [nova, ...prev]);
  };

  // Motivos presentes nas anotações
  const motivosPresentes = ["TODOS", ...new Set(anotacoes.map(a => a.MOTIVO).filter(Boolean))];

  const filtrados = anotacoes.filter(a => {
    const matchMotivo   = filtroMotivo === "TODOS" || a.MOTIVO === filtroMotivo;
    const matchEntidade = !filtroEntidade || (a.ENTIDADE || "").toLowerCase().includes(filtroEntidade.toLowerCase());
    const matchBusca    = !busca || [a.ENTIDADE, a.MOTIVO, a.BEM_VINCULADO, a.OBSERVACOES].join(" ").toLowerCase().includes(busca.toLowerCase());
    return matchMotivo && matchEntidade && matchBusca;
  });

  // Contagem por motivo
  const contagemMotivo = {};
  anotacoes.forEach(a => { contagemMotivo[a.MOTIVO] = (contagemMotivo[a.MOTIVO] || 0) + 1; });

  // Entidades mais recusadas (top 5)
  const contagemEntidade = {};
  anotacoes.forEach(a => { if (a.ENTIDADE) contagemEntidade[a.ENTIDADE] = (contagemEntidade[a.ENTIDADE] || 0) + 1; });
  const topEntidades = Object.entries(contagemEntidade)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="signu-layout" style={{ background: "#dde1e7", fontFamily: "'Inter', system-ui, sans-serif", color: "#111827" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        ::-webkit-scrollbar { width: 4px }
        ::-webkit-scrollbar-thumb { background: #9ca3af; border-radius: 4px }
      `}</style>

      <Sidebar />

      <main className="signu-main">

        {/* Top bar */}
        <header style={{
          height: 56, background: "#1e2d3d",
          borderBottom: "1px solid #e5e7eb",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 28px", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#4b5563" }}>SIGNU</span>
            <span style={{ color: "#d1d5db" }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Anotações de Doações</span>
          </div>
          {carregando && <Spinner />}
        </header>

        <div style={{ flex: 1, overflow: "auto", padding: "28px" }}>

          {/* Cabeçalho */}
          <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                📝 Doações não realizadas
              </h1>
              <p style={{ fontSize: 13, color: "#4b5563", margin: 0 }}>
                Registro de motivos de recusa por entidade — {anotacoes.length} anotaç{anotacoes.length !== 1 ? "ões" : "ão"}
              </p>
            </div>
            <button
              onClick={() => setModalAberto(true)}
              style={{
                padding: "9px 18px", borderRadius: 8, border: "1.5px solid rgba(37,99,235,0.3)",
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(37,99,235,0.05))",
                color: "#2563eb", fontSize: 13, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
              }}>
              + Nova Anotação
            </button>
          </div>

          {/* Cards de resumo */}
          {anotacoes.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
              {Object.entries(contagemMotivo).sort((a,b) => b[1]-a[1]).map(([motivo, count]) => {
                const m = MOTIVO_COLOR[motivo] || MOTIVO_COLOR["Outro"];
                return (
                  <div key={motivo}
                    onClick={() => setFiltroMotivo(filtroMotivo === motivo ? "TODOS" : motivo)}
                    style={{
                      padding: "14px 16px",
                      background: filtroMotivo === motivo ? m.bg : "#f9fafb",
                      border: `1px solid ${filtroMotivo === motivo ? m.color + "44" : "#e5e7eb"}`,
                      borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                    }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: m.color, marginBottom: 4 }}>{count}</div>
                    <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.4 }}>{motivo}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Filtros */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar em todas as anotações…"
              style={{
                flex: 1, minWidth: 200, padding: "8px 12px",
                background: "#f3f4f6", border: "1px solid #d1d5db",
                borderRadius: 8, color: "#fff", fontSize: 13, outline: "none",
              }}
            />
            <input
              type="text" value={filtroEntidade} onChange={e => setFiltroEntidade(e.target.value)}
              placeholder="Filtrar por entidade…"
              style={{
                width: 220, padding: "8px 12px",
                background: "#f3f4f6", border: "1px solid #d1d5db",
                borderRadius: 8, color: "#fff", fontSize: 13, outline: "none",
              }}
            />
            {filtroMotivo !== "TODOS" && (
              <button onClick={() => setFiltroMotivo("TODOS")}
                style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(37,99,235,0.25)", background: "rgba(37,99,235,0.07)", color: "#2563eb", fontSize: 12, cursor: "pointer" }}>
                ✕ Limpar filtro
              </button>
            )}
          </div>

          {/* Lista de anotações */}
          {carregando ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#6b7280" }}>
              <Spinner /><div style={{ marginTop: 12 }}>Carregando anotações…</div>
            </div>
          ) : filtrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#6b7280" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14 }}>
                {anotacoes.length === 0
                  ? "Nenhuma anotação registrada. Clique em \"+ Nova Anotação\" para começar."
                  : "Nenhuma anotação com estes filtros."}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtrados.map((a, i) => (
                <div key={a._rowNumber || i} style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12, padding: "16px 20px",
                  display: "flex", gap: 16, alignItems: "flex-start",
                  animation: "fadeIn 0.25s ease",
                }}>
                  {/* Ícone */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: "rgba(248,113,113,0.1)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                  }}>🚫</div>

                  {/* Conteúdo */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{a.ENTIDADE}</span>
                      <MotivoBadge motivo={a.MOTIVO} />
                    </div>
                    {a.BEM_VINCULADO && (
                      <div style={{ fontSize: 12, color: "#374151", marginBottom: 4, fontFamily: "'IBM Plex Mono', monospace" }}>
                        📦 {a.BEM_VINCULADO}
                      </div>
                    )}
                    {a.OBSERVACOES && (
                      <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
                        {a.OBSERVACOES}
                      </div>
                    )}
                  </div>

                  {/* Data */}
                  <div style={{ fontSize: 11, color: "#6b7280", flexShrink: 0, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {a.DATA || "—"}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Painel lateral: entidades mais recusadas */}
          {topEntidades.length > 0 && (
            <div style={{ marginTop: 32, padding: "20px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, maxWidth: 500 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                Entidades com mais registros de recusa
              </div>
              {topEntidades.map(([ent, count]) => (
                <div key={ent} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, fontSize: 12, color: "#111827", lineHeight: 1.4 }}>{ent}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: "#f87171",
                    background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)",
                    padding: "2px 10px", borderRadius: 12,
                  }}>{count}×</div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>

      {modalAberto && (
        <NovaAnotacaoModal
          onClose={() => setModalAberto(false)}
          onSalvo={handleSalvo}
        />
      )}
    </div>
  );
}
