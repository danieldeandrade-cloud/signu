// lib/lotesDpj.js
//
// Na DPJ-GC99 a unidade de trabalho é o LOTE, não o item: um lote (mesmo LOTE
// e PA) pode ter vários itens avaliados individualmente, cada um numa linha
// própria (ver detalhes → "Itens deste lote"). Para CONTAGENS (painel,
// e-mail, Minha Fila, Gestão) os itens de um lote valem 1 só. Nas demais
// listas cada linha é uma unidade.
//
// Puro, sem I/O — usado no cliente e no servidor.

const ehDpj = (lista) => ["DPJ_GC99", "dpj", "DPJ-GC99"].includes(lista);

export function chaveUnidade(lista, r) {
  const lote = String(r?.LOTE || "").trim();
  return ehDpj(lista) && lote ? `lote:${lote}` : `row:${r?._rowNumber}`;
}

export function contarUnidades(rows, lista) {
  return new Set((rows || []).map((r) => chaveUnidade(lista, r))).size;
}

// Agrupa as linhas por unidade. `rep` = linha que representa o lote (a 1ª com
// status preenchido — o item original do lote), `itens` = todas as linhas.
export function agruparUnidades(rows, lista, campoStatus = "STATUS_DILIGENCIA") {
  const grupos = new Map();
  (rows || []).forEach((r) => {
    const k = chaveUnidade(lista, r);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(r);
  });
  return [...grupos.values()].map((itens) => ({
    rep: itens.find((r) => String(r[campoStatus] || "").trim()) || itens[0],
    itens,
  }));
}
