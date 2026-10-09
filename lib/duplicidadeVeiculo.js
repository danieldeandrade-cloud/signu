// lib/duplicidadeVeiculo.js
//
// Server-side: impede o MESMO veículo em duas listas de veículos (CEGOC,
// PCDF 1ª, PCDF 2ª) — ou duas vezes na mesma. Casos reais (2026-10-08): a
// planilha antiga deixava o veículo na CEGOC ("EM DILIGÊNCIA HIGEIA") e
// copiava pra PCDF 2º; e a promoção da Importação SEI criava um registro novo
// na PCDF 2ª mesmo com o aviso "Já cadastrado" na tela. Mudança de lista tem
// que ser pela transição (que move: cria no destino e apaga da origem).
//
// DPJ, Caixa SEI e Doações ficam de fora: lá o mesmo PA pode aparecer
// legitimamente (ex.: a Caixa SEI de um processo que está na CEGOC).

import { getAllRows } from './googleSheets';
import { resolveSheetName } from './listas';

export const LISTAS_VEICULO = ['cegoc', 'pcdf1', 'pcdf2'];
const LABEL = { cegoc: 'CEGOC', pcdf1: 'PCDF 1ª HIGEIA', pcdf2: 'PCDF 2ª HIGEIA' };

const norm = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// Valores de "não tem" que não podem casar entre si
const VAZIOS = new Set(['NC', 'NA', 'NAO', 'NAOAFLORADO', 'SEMNIV', 'NAOINFORMADO']);
const chave = (v) => {
  const n = norm(v);
  return n.length >= 10 && !VAZIOS.has(n) ? n : '';
};

// dados: { ID_PASEI, NIV }. ignorar: [{ lista, rowNumber }] (o próprio item numa
// edição, ou a origem numa transição). Devolve o 1º conflito ou null.
export async function acharDuplicadoVeiculo(dados, { ignorar = [] } = {}) {
  const pa = chave(dados?.ID_PASEI);
  const niv = chave(dados?.NIV);
  if (!pa && !niv) return null;
  const pular = new Set(ignorar.map((i) => `${i.lista}:${i.rowNumber}`));

  for (const lista of LISTAS_VEICULO) {
    const rows = await getAllRows(resolveSheetName(lista));
    for (const r of rows) {
      if (pular.has(`${lista}:${r._rowNumber}`)) continue;
      // NIV igual = mesmo veículo. PA igual também, A MENOS que os dois tenham
      // NIV válido e diferente — um processo pode ter mais de um veículo
      // (ex.: PA 0026645/2025 na PCDF 1ª, dois carros).
      const nivRow = chave(r.NIV);
      const mesmoNiv = niv && nivRow === niv;
      const veiculosDiferentes = niv && nivRow && nivRow !== niv;
      const campo = mesmoNiv ? 'NIV' : (pa && chave(r.ID_PASEI) === pa && !veiculosDiferentes) ? 'PA' : null;
      if (campo) return { lista, label: LABEL[lista], rowNumber: r._rowNumber, item: r, campo };
    }
  }
  return null;
}

// Listas em que todo item precisa nascer com responsável (Doações não: lote
// "aguardando início" fica sem responsável de propósito — ver lib/filaDoacoes.js).
// Itens sem responsável somem da Minha Fila de todo mundo; 29 da PCDF 1ª/2ª
// estavam assim em 2026-10-09 (herdados do XLSM ou inseridos em 01–08/09).
export const LISTAS_COM_RESPONSAVEL = ['cegoc', 'pcdf1', 'pcdf2', 'dpj'];
export function faltaResponsavel(lista, dados) {
  const r = String(dados?.RESPONSAVEL || '').trim();
  return LISTAS_COM_RESPONSAVEL.includes(lista) && (!r || r === '__AUTO__');
}

export function mensagemDuplicado(d) {
  const id = d.item.ID || d.item.ID_LEGADO || `linha ${d.rowNumber}`;
  const valor = d.campo === 'PA' ? d.item.ID_PASEI : d.item.NIV;
  // Item RETIRADO que voltou (ex.: restituição revertida, volta p/ leilão): reabrir, não recadastrar
  if (String(d.item.STATUS_DILIGENCIA || '').toUpperCase().trim() === 'RETIRADO') {
    return `Este veículo já está cadastrado em ${d.label} (${id}) — mesmo ${d.campo} ${valor} — e está RETIRADO. ` +
      'Se ele voltou para novas diligências, abra o registro existente e use "Reabrir item" em vez de cadastrar de novo.';
  }
  return `Este veículo já está cadastrado em ${d.label} (${id}) — mesmo ${d.campo} ${valor}. ` +
    'O mesmo bem não pode ficar em duas listas de veículos. Se ele mudou de lista, use a transição ' +
    '(ex.: CEGOC → 2ª HIGEIA) em vez de cadastrar de novo.' +
    (d.campo === 'PA' ? ' Se for outro veículo do mesmo processo, informe o NIV dele.' : '');
}
