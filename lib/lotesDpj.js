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
