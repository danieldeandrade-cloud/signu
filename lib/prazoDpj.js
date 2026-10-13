// lib/prazoDpj.js — prazo de 6 meses da DPJ-GC99 (regra do NULEJ, definida
// pelo Daniel em 2026-10-13): 6 MESES DE CALENDÁRIO a partir da data de
// entrada (02/03 → 02/09), não 180 dias. Se o dia não existe no mês final
// (31/08 → fev.), vale o último dia daquele mês. Puro — cliente e servidor.

function partes(v) {
  const s = String(v || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return [+m[1], +m[2], +m[3]];
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return [+m[3], +m[2], +m[1]];
  return null;
}

const iso = (a, m, d) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// "aaaa-mm-dd" do vencimento, ou "" se a data de entrada for inválida
export function prazo6Meses(dataEntrada) {
  const p = partes(dataEntrada);
  if (!p) return "";
  let [a, m, d] = p;
  m += 6;
  if (m > 12) { m -= 12; a += 1; }
  const ultimoDia = new Date(a, m, 0).getDate();
  return iso(a, m, Math.min(d, ultimoDia));
}

// Hoje (Brasília) em aaaa-mm-dd — comparável como texto com prazo6Meses()
export function hojeBrasilia() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export function prazoVencido(dataEntrada) {
  const p = prazo6Meses(dataEntrada);
  return !!p && p <= hojeBrasilia();
}
