// lib/duplicidadeLote.js
//
// DPJ-GC99: o mesmo LOTE só pode aparecer com UM PA. Vários itens do mesmo
// lote com o mesmo PA são normais (cada item é uma linha); o mesmo lote em PA
// diferente é erro de cadastro (regra do Daniel, 2026-10-22). Na DPJ este é o
// ÚNICO bloqueio/alerta de duplicidade — não vale a checagem por PA/NIV das
// listas de veículos (lib/duplicidadeVeiculo.js).
//
// Servidor: lê a aba e usa loteEmOutroPa (lib/lotesDpj.js — puro, serve também às telas).

import { getAllRows } from './googleSheets';
import { resolveSheetName } from './listas';
import { loteEmOutroPa } from './lotesDpj';

export async function acharLoteEmOutroPa(dados, opcoes) {
  return loteEmOutroPa(await getAllRows(resolveSheetName('dpj')), dados, opcoes);
}

export function mensagemLoteOutroPa(dados, existente) {
  return `O lote ${String(dados.LOTE).trim()} já existe com outro PA (${existente.PA || existente.PA_PJE}, linha ${existente._rowNumber}). ` +
    'O mesmo lote só pode ter itens do mesmo PA — confira o número do lote ou do PA.';
}
