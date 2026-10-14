// lib/parados.js
//
// Regra única de "PARADO há +21 dias" — usada pelo painel de Início, pelo
// filtro da Gestão e pelo da Minha Fila (e espelhada em
// app/api/notificacoes/route.js, `contaComoParado`).
//
// Parado = item ATIVO (status não encerrado) sem nenhuma mexida
// (ULTIMA_ANALISE → DATA_ATUALIZACAO → DATA_CADASTRO) há DIAS_PARADO dias ou
// mais. Fora da conta: DPJ-GC99 em "PRAZO 6 MESES" (o NULEJ só assume depois
// dos 6 meses da entrada). Na DPJ vale o LOTE: o lote está parado se nenhum
// item ativo dele mexeu — e aí todos os itens ativos do lote aparecem.
//
// Puro, sem I/O — cliente e servidor.

import { agruparUnidades } from "./lotesDpj";

export const DIAS_PARADO = 21;
export const STATUS_ENCERRADO = ["RETIRADO", "BAIXADO", "CONCLUÍDO", "CONCLUIDO", "CANCELADO", "ARQUIVADO", "DOAÇÃO REALIZADA", "VENDIDO E RETIRADO"];

const norm = (v) => String(v || "").toUpperCase().trim();
export const ehEncerrado = (st) => STATUS_ENCERRADO.includes(norm(st));
const ehDpj = (lista) => ["DPJ_GC99", "dpj", "DPJ-GC99"].includes(lista);
export const podeFicarParado = (lista, st) => !(ehDpj(lista) && norm(st) === "PRAZO 6 MESES");

export function parseDataFlex(v) {
  if (!v) return 0;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  const d = new Date(s);
  return isNaN(d) ? 0 : d.getTime();
}

export function diasSemMexida(item) {
  const t = parseDataFlex(item.ULTIMA_ANALISE) || parseDataFlex(item.DATA_ATUALIZACAO) || parseDataFlex(item.DATA_CADASTRO);
  return t ? Math.floor((Date.now() - t) / 86400000) : null;
}

// rows de UMA lista; statusDe(r) = status do item nessa lista.
// Devolve Set com os _rowNumber dos itens parados.
export function rowsParados(rows, lista, statusDe) {
  const set = new Set();
  agruparUnidades(rows, lista, "__status__", () => false)
    .forEach(({ itens }) => {
      const ativos = itens.filter((r) => !ehEncerrado(statusDe(r)) && podeFicarParado(lista, statusDe(r)));
      if (!ativos.length) return;
      const dias = ativos.map(diasSemMexida).filter((d) => d !== null);
      if (dias.length && Math.min(...dias) >= DIAS_PARADO) ativos.forEach((r) => set.add(r._rowNumber));
    });
  return set;
}
