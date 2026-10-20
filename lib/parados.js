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
// Exceção (regra do Daniel, 2026-10-20): item da DPJ-GC99 em "DOAÇÃO EM
// ANDAMENTO" cuja doação (mesmo PA, aba de Doações) está "AGUARDANDO APTIDÃO"
// espera a desvinculação de débitos — o limite sobe p/ 30 dias. Vale também p/
// o registro "aguardando aptidão" na própria aba de Doações. A contagem parte da
// atualização mais recente entre o item da DPJ e o registro da doação.
export const DIAS_PARADO_APTIDAO = 30;
const STATUS_DPJ_DOACAO = "DOAÇÃO EM ANDAMENTO";
const STATUS_APTIDAO = "AGUARDANDO APTIDÃO";
export const STATUS_ENCERRADO = ["RETIRADO", "BAIXADO", "CONCLUÍDO", "CONCLUIDO", "CANCELADO", "ARQUIVADO", "DOAÇÃO REALIZADA", "VENDIDO E RETIRADO"];

const norm = (v) => String(v || "").toUpperCase().trim();
export const ehEncerrado = (st) => STATUS_ENCERRADO.includes(norm(st));
const ehDpj = (lista) => ["DPJ_GC99", "dpj", "DPJ-GC99"].includes(lista);
// STANDBY (PCDF 1ª/2ª, regra do Daniel 2026-10-19): ofício de baixa já foi
// enviado ao DETRAN e a obrigação do NULEJ (comunicar) está cumprida — o item
// não é arquivado, mas sai do controle de prazo enquanto aguarda a resposta.
export const STATUS_STANDBY = ["AGUARDANDO BAIXA DEFINITIVA DETRAN"];
export const podeFicarParado = (lista, st) =>
  !(ehDpj(lista) && norm(st) === "PRAZO 6 MESES") && !STATUS_STANDBY.includes(norm(st));

// Selo "NOVO" (item ainda não visto pelo responsável). Na DPJ-GC99 um item em
// "PRAZO 6 MESES" nunca é novo: o NULEJ só assume depois do marco de 6 meses.
// Quando o prazo vence, a rotina diária passa o item p/ EM DILIGÊNCIA e limpa
// o VISTO_EM (updateRow marcarNovo) — aí sim ganha o selo.
export const ehNovoItem = (lista, item, status) =>
  !item?.VISTO_EM && !(ehDpj(lista) && norm(status ?? item?.STATUS_DILIGENCIA) === "PRAZO 6 MESES");

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

const ehDoacoes = (lista) => ["DOACOES", "doacoes_diligencia", "Doações"].includes(lista);
const paKey = (v) => String(v || "").replace(/\D/g, "");

// Contexto da exceção acima, a partir das linhas das duas abas. Só objetos
// simples (vai e volta em JSON: /api/parados/contexto).
//   aptidao[pa]    → há doação "aguardando aptidão" p/ esse PA
//   diasDoacao[pa] → dias desde a última atualização desse registro de doação
//   diasDpj[pa]    → idem, do item da DPJ "doação em andamento" do mesmo PA
export function contextoAptidao(doacoesRows, dpjRows) {
  const ctx = { aptidao: {}, diasDoacao: {}, diasDpj: {} };
  const menor = (obj, k, d) => { if (d !== null && (obj[k] === undefined || d < obj[k])) obj[k] = d; };
  (doacoesRows || []).forEach((r) => {
    if (norm(r.STATUS_LOCAL_PA) !== STATUS_APTIDAO) return;
    const k = paKey(r.ID_PASEI); if (!k) return;
    ctx.aptidao[k] = true;
    menor(ctx.diasDoacao, k, diasSemMexida(r));
  });
  (dpjRows || []).forEach((r) => {
    if (norm(r.STATUS_DILIGENCIA) !== STATUS_DPJ_DOACAO) return;
    const k = paKey(r.PA || r.PA_PJE); if (!k || !ctx.aptidao[k]) return;
    menor(ctx.diasDpj, k, diasSemMexida(r));
  });
  return ctx;
}

// Decide se uma UNIDADE (lote da DPJ ou linha das demais listas) está parada.
// itensAtivos = itens ativos da unidade. Devolve null (nada a controlar) ou
// { parado, dias, limite } — `limite` é 21, ou 30 na exceção de aptidão.
export function avaliarParado(lista, itensAtivos, statusDe, ctx) {
  const itens = (itensAtivos || []).filter((r) => podeFicarParado(lista, statusDe(r)));
  if (!itens.length) return null;
  let limite = DIAS_PARADO;
  const dias = [];
  itens.forEach((r) => {
    const d = diasSemMexida(r);
    if (d !== null) dias.push(d);
    const k = paKey(r.ID_PASEI || r.PA || r.PA_PJE);
    const st = norm(statusDe(r));
    if (ehDpj(lista) && st === STATUS_DPJ_DOACAO && ctx?.aptidao?.[k]) {
      limite = DIAS_PARADO_APTIDAO;
      if (ctx.diasDoacao?.[k] !== undefined) dias.push(ctx.diasDoacao[k]);
    }
    if (ehDoacoes(lista) && st === STATUS_APTIDAO) {
      limite = DIAS_PARADO_APTIDAO;
      if (ctx?.diasDpj?.[k] !== undefined) dias.push(ctx.diasDpj[k]);
    }
  });
  if (!dias.length) return { parado: false, dias: null, limite };
  const d = Math.min(...dias);
  return { parado: d >= limite, dias: d, limite };
}

// rows de UMA lista; statusDe(r) = status do item nessa lista; ctx opcional
// (contextoAptidao). Devolve Set com os _rowNumber dos itens parados.
export function rowsParados(rows, lista, statusDe, ctx) {
  const set = new Set();
  agruparUnidades(rows, lista, "__status__", () => false)
    .forEach(({ itens }) => {
      const ativos = itens.filter((r) => !ehEncerrado(statusDe(r)));
      if (avaliarParado(lista, ativos, statusDe, ctx)?.parado) {
        ativos.filter((r) => podeFicarParado(lista, statusDe(r))).forEach((r) => set.add(r._rowNumber));
      }
    });
  return set;
}
