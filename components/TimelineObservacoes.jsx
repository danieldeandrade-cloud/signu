"use client";
// components/TimelineObservacoes.jsx
//
// Linha do tempo de OBSERVACOES com adicionar / retificar / excluir — usada no
// Detalhes e no painel lateral da Minha Fila. O componente só cuida da tela:
// quem grava na planilha são os callbacks (onSalvar / onAlterarNota), que
// cada tela implementa (releitura do servidor antes de alterar, etc.).

import { useState } from "react";
import { useSession } from "next-auth/react";
import { parseNotas } from "@/lib/observacoes";
import { getNomePorEmail } from "@/lib/servidores";
import { agoraServidor, carimboBR } from "@/lib/horaServidor";

// Carimbo pela hora do SERVIDOR (fuso de Brasília), não do computador de quem
// anota — relógio local errado deixava a nota com horário trocado.
async function formatarNovaEntrada(texto, nomeUsuario) {
  const autor = (nomeUsuario || "").split(" ")[0] || "Sistema";
  return `[${carimboBR(await agoraServidor())} | ${autor}] ${texto.trim()}`;
}

// Quem pode retificar/excluir uma anotação: o próprio autor ou um gestor.
// Notas antigas sem autor (migradas da planilha) ficam só com os gestores.
const GESTORES_OBS = ["danieldeandrade.pessoal@gmail.com", "danieldeandrade@icloud.com", "carlosalex1318@gmail.com"];
const primeiroNome = (s) => (s || "").trim().split(/\s+/)[0].toLowerCase();

const AVISO_PADRAO = <>⚠️ "Adicionar" só registra a anotação. Para gravar as <b>demais alterações</b> do bem, clique em <b>«Salvar»</b> no topo da página.</>;

// `aviso`: texto do quadro amarelo sob o campo (null esconde). O padrão é o do Detalhes.
export default function TimelineObservacoes({ obsStr, onSalvar, onAlterarNota, salvando, aviso = AVISO_PADRAO }) {
  const [novaNota, setNovaNota] = useState("");
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [editando, setEditando] = useState(null);   // _start da nota em edição
  const [textoEdicao, setTextoEdicao] = useState("");
  const [alterando, setAlterando] = useState(false);
  const { data: session } = useSession();
  const nomeUsuario = session?.user?.name || "";
  const email = (session?.user?.email || "").toLowerCase();
  const ehGestor = GESTORES_OBS.includes(email);
  const meusNomes = [primeiroNome(nomeUsuario), primeiroNome(getNomePorEmail(email))].filter(Boolean);
  const podeAlterar = (nota) => ehGestor || (nota.autor && meusNomes.includes(primeiroNome(nota.autor)));
  const notas = parseNotas(obsStr);

  const carimbo = async () => carimboBR(await agoraServidor());
  const quem = () => getNomePorEmail(email) || nomeUsuario || "usuário";

  const salvarRetificacao = async (nota) => {
    const texto = textoEdicao.trim();
    if (!texto || texto === nota.texto) { setEditando(null); return; }
    // Mantém data/autor originais (a nota não muda de lugar na linha do tempo)
    const cab = nota.autor ? `[${nota.ts} | ${nota.autor}]` : (nota.ts ? `[${nota.ts}]` : "");
    const novoTrecho = `${cab ? cab + " " : ""}${texto} (retificado em ${await carimbo()} por ${quem()})`;
    setAlterando(true);
    const ok = await onAlterarNota(nota, novoTrecho);
    setAlterando(false);
    if (ok) setEditando(null);
  };

  const excluir = async (nota) => {
    const resumo = nota.texto.length > 120 ? nota.texto.slice(0, 120) + "…" : nota.texto;
    if (!window.confirm(`Excluir esta anotação?\n\n${nota.autor ? nota.autor + " · " : ""}${nota.ts}\n"${resumo}"\n\nO texto original fica guardado no histórico de alterações.`)) return;
    setAlterando(true);
    await onAlterarNota(nota, "");
    setAlterando(false);
  };

  const handleSalvarNota = async () => {
    if (!novaNota.trim()) return;
    setSalvandoNota(true);
    const entrada = await formatarNovaEntrada(novaNota, nomeUsuario);
    // Prepend: nova nota fica no topo do campo
    const novoObs = obsStr?.trim()
      ? `${entrada}\n${obsStr.trim()}`
      : entrada;
    await onSalvar(novoObs);
    setNovaNota("");
    setSalvandoNota(false);
  };

  return (
    <div>
      {/* Input de nova nota */}
      <div style={{ marginBottom:6, display:"flex", gap:8 }}>
        <textarea
          value={novaNota}
          onChange={e => setNovaNota(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSalvarNota(); }}
          placeholder="Nova anotação… (Ctrl+Enter para adicionar)"
          rows={2}
          style={{ flex:1, padding:"9px 12px", background:"#f3f4f6", border:"1.5px solid #b0b8c4", borderRadius:8, color:"#0f172a", fontSize:13, lineHeight:1.5, resize:"vertical", outline:"none", fontFamily:"inherit" }}
        />
        <button
          onClick={handleSalvarNota}
          disabled={!novaNota.trim() || salvandoNota}
          style={{ padding:"0 16px", background: novaNota.trim() ? "rgba(37,99,235,0.12)" : "#f3f4f6", border:`1px solid ${novaNota.trim() ? "rgba(37,99,235,0.4)" : "#e5e7eb"}`, borderRadius:8, color: novaNota.trim() ? "#2563eb" : "#9ca3af", fontSize:12, fontWeight:700, cursor: novaNota.trim() ? "pointer" : "default", transition:"all 0.15s", whiteSpace:"nowrap", alignSelf:"flex-start", height:38 }}
        >
          {salvandoNota ? "…" : "＋ Adicionar"}
        </button>
      </div>
      {aviso && (
        <div style={{ fontSize:11, color:"#b45309", background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:8, padding:"7px 10px", marginBottom:16 }}>
          {aviso}
        </div>
      )}

      {/* Timeline */}
      {notas.length === 0 ? (
        <p style={{ fontSize:13, color:"#9ca3af", fontStyle:"italic", margin:0 }}>Nenhuma anotação ainda.</p>
      ) : (
        <div style={{ position:"relative", paddingLeft:20 }}>
          {/* Linha vertical */}
          <div style={{ position:"absolute", left:7, top:8, bottom:8, width:2, background:"rgba(37,99,235,0.12)", borderRadius:2 }}/>
          {notas.map((nota, i) => (
            <div key={i} style={{ position:"relative", marginBottom: i < notas.length-1 ? 18 : 0 }}>
              {/* Bolinha */}
              <div style={{ position:"absolute", left:-20, top:6, width:10, height:10, borderRadius:"50%", background: i===0 ? "#2563eb" : "rgba(37,99,235,0.3)", border:"2px solid #fff", boxSizing:"border-box" }}/>
              <div style={{ background:"#f9fafb", border:`1px solid ${i===0?"rgba(37,99,235,0.2)":"#f3f4f6"}`, borderRadius:8, padding:"10px 14px" }}>
                <div style={{ display:"flex", gap:8, marginBottom: (nota.ts || nota.autor) ? 5 : 0, alignItems:"center" }}>
                  {nota.autor && (
                    <span style={{ fontSize:11, fontWeight:700, color:"#2563eb" }}>{nota.autor}</span>
                  )}
                  {nota.ts && (
                    <span style={{ fontSize:10, color:"#6b7280" }}>{nota.ts}</span>
                  )}
                  {podeAlterar(nota) && editando !== nota._start && (
                    <span style={{ marginLeft:"auto", display:"flex", gap:4 }}>
                      <button onClick={() => { setEditando(nota._start); setTextoEdicao(nota.texto.replace(/\s*\(retificado em [^)]*\)\s*$/, "")); }} disabled={alterando}
                        title="Retificar esta anotação" style={{ background:"none", border:"1px solid #d1d5db", borderRadius:6, padding:"1px 7px", fontSize:11, color:"#4b5563", cursor:"pointer" }}>✏️ Retificar</button>
                      <button onClick={() => excluir(nota)} disabled={alterando}
                        title="Excluir esta anotação" style={{ background:"none", border:"1px solid #fecaca", borderRadius:6, padding:"1px 7px", fontSize:11, color:"#dc2626", cursor:"pointer" }}>🗑 Excluir</button>
                    </span>
                  )}
                </div>
                {editando === nota._start ? (
                  <div>
                    <textarea value={textoEdicao} onChange={e => setTextoEdicao(e.target.value)} rows={3} autoFocus
                      style={{ width:"100%", boxSizing:"border-box", padding:"8px 10px", background:"#fff", border:"1.5px solid #93c5fd", borderRadius:8, color:"#0f172a", fontSize:13, lineHeight:1.5, resize:"vertical", outline:"none", fontFamily:"inherit" }}/>
                    <div style={{ display:"flex", gap:6, marginTop:6, alignItems:"center" }}>
                      <button onClick={() => salvarRetificacao(nota)} disabled={alterando || !textoEdicao.trim()}
                        style={{ padding:"5px 12px", borderRadius:6, border:"1px solid rgba(34,197,94,0.5)", background:"rgba(34,197,94,0.12)", color:"#15803d", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        {alterando ? "Salvando…" : "✓ Salvar retificação"}
                      </button>
                      <button onClick={() => setEditando(null)} disabled={alterando}
                        style={{ padding:"5px 12px", borderRadius:6, border:"1px solid #d1d5db", background:"#f3f4f6", color:"#4b5563", fontSize:12, cursor:"pointer" }}>Cancelar</button>
                      <span style={{ fontSize:10, color:"#6b7280" }}>A nota recebe a marca “retificado em … por …”.</span>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize:13, color:"#111827", lineHeight:1.6, margin:0 }}>{nota.texto}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
