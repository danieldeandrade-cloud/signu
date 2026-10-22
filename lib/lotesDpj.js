// lib/lotesDpj.js
//
// Na DPJ-GC99 a unidade de trabalho é o LOTE, não o item: um lote (mesmo LOTE
// e PA) pode ter vários itens avaliados individualmente, cada um numa linha
// própria (ver detalhes → "Itens deste lote"). Para CONTAGENS (painel,
// e-mail, Minha Fila, Gestão) os itens de um lote valem 1 só. Nas demais
// listas cada linha é uma unidade.
//
// Puro, sem I/O — usado no cliente e no servidor.

// Resumo de um lote p/ exibição: { total, sairam } — "saiu" = item encerrado.
export function resumoLote(itens, ehEncerrado, campoStatus = "STATUS_DILIGENCIA") {
  const sairam = (itens || []).filter((r) => ehEncerrado(r[campoStatus])).length;
  return { total: (itens || []).length, sairam };
}

const ehDpj = (lista) => ["DPJ_GC99", "dpj", "DPJ-GC99"].includes(lista);

export function chaveUnidade(lista, r) {
  const lote = String(r?.LOTE || "").trim();
  return ehDpj(lista) && lote ? `lote:${lote}` : `row:${r?._rowNumber}`;
}

export function contarUnidades(rows, lista) {
  return new Set((rows || []).map((r) => chaveUnidade(lista, r))).size;
}

// Agrupa as linhas por unidade. Itens do mesmo lote podem ter destinos
// diferentes (vende-se 1, os outros seguem no depósito), então o lote fica
// ATIVO enquanto tiver ao menos 1 item ativo e só encerra quando todos
// encerrarem. `rep` = item que representa o lote nas contagens (o 1º item
// ainda ativo; se todos encerraram, o 1º com status); `ativos` = itens ativos.
export function agruparUnidades(rows, lista, campoStatus = "STATUS_DILIGENCIA", ehEncerrado = () => false) {
  const grupos = new Map();
  (rows || []).forEach((r) => {
    const k = chaveUnidade(lista, r);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(r);
  });
  const temStatus = (r) => String(r[campoStatus] || "").trim();
  return [...grupos.values()].map((itens) => {
    const ativos = itens.filter((r) => !ehEncerrado(r[campoStatus]));
    const rep = ativos.find(temStatus) || ativos[0] || itens.find(temStatus) || itens[0];
    return { rep, itens, ativos };
  });
}

// DPJ-GC99: o mesmo LOTE só pode aparecer com UM PA (vários itens do mesmo lote
// com o mesmo PA são normais). Devolve a 1ª linha com o MESMO lote e PA DIFERENTE,
// ou null; lote ou PA vazios não têm o que comparar. (regra do Daniel, 2026-10-22)
const chaveLote = (v) => String(v || '').trim().toUpperCase();
const chavePa = (v) => String(v || '').replace(/\D/g, '');

// rows: linhas da DPJ. Devolve a 1ª linha com o MESMO lote e PA DIFERENTE, ou null.
// Se o lote ou o PA estiverem vazios, não há o que comparar.
export function loteEmOutroPa(rows, { LOTE, PA, PA_PJE }, { ignorarRow } = {}) {
  const lote = chaveLote(LOTE);
  const pa = chavePa(PA || PA_PJE);
  if (!lote || !pa) return null;
  return (rows || []).find((r) => {
    if (ignorarRow != null && String(r._rowNumber) === String(ignorarRow)) return false;
    const paR = chavePa(r.PA || r.PA_PJE);
    return chaveLote(r.LOTE) === lote && paR && paR !== pa;
  }) || null;
}

