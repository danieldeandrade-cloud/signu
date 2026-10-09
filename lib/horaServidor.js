// lib/horaServidor.js — client: data/hora confiáveis p/ carimbar anotações.
// Usa a hora do servidor (/api/hora) e sempre o fuso de Brasília; se a
// chamada falhar, cai no relógio local (melhor que não anotar).

export async function agoraServidor() {
  try {
    const r = await fetch("/api/hora", { cache: "no-store" });
    const j = await r.json();
    const d = new Date(j.agora);
    return isNaN(d) ? new Date() : d;
  } catch {
    return new Date();
  }
}

// "dd/mm/aaaa HH:MM" no horário de Brasília
export function carimboBR(d) {
  const tz = { timeZone: "America/Sao_Paulo" };
  return `${d.toLocaleDateString("pt-BR", tz)} ${d.toLocaleTimeString("pt-BR", { ...tz, hour: "2-digit", minute: "2-digit" })}`;
}
