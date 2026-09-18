// lib/historico.js
//
// Log de auditoria (aba Historico_Alteracoes) — registra quem editou o quê,
// quando, e o que mudou. Base para relatórios de produtividade por servidor
// (hoje o sistema só guarda o estado atual de cada item; sem isso não dá pra
// saber quantos itens um servidor concluiu num período, só o que está
// pendente agora).

import { addRow } from './googleSheets';
import { resolveSheetName } from './listas';

// Campos que não interessam pro histórico (metadados que mudam sempre,
// não representam trabalho de verdade).
const CAMPOS_IGNORADOS = new Set(['DATA_ATUALIZACAO', 'ULTIMA_ANALISE', 'MODIFICADO_POR']);

// Monta o diff {campo: {de, para}} entre o estado anterior e os campos que
// vieram no PATCH — só inclui campos que de fato mudaram.
export function diffCampos(anterior, novo) {
  const diff = {};
  for (const [campo, valorNovo] of Object.entries(novo || {})) {
    if (CAMPOS_IGNORADOS.has(campo)) continue;
    const valorAntigo = anterior ? anterior[campo] : undefined;
    const a = valorAntigo === undefined || valorAntigo === null ? '' : String(valorAntigo);
    const b = valorNovo === undefined || valorNovo === null ? '' : String(valorNovo);
    if (a !== b) diff[campo] = { de: a, para: b };
  }
  return diff;
}

export async function registrarHistorico({ lista, rowNumber, itemId, acao, autor, camposAlterados }) {
  try {
    await addRow(resolveSheetName('historico'), {
      TIMESTAMP: new Date().toISOString(),
      LISTA: lista || '',
      ROW_NUMBER: rowNumber != null ? String(rowNumber) : '',
      ITEM_ID: itemId || '',
      ACAO: acao || '',
      AUTOR: autor || '',
      CAMPOS_ALTERADOS: JSON.stringify(camposAlterados || {}),
    });
  } catch (e) {
    // Nunca deixa uma falha no log de auditoria quebrar a ação principal
    // (criar/editar o item de verdade) — só registra no console do servidor.
    console.error('[historico] falha ao registrar:', e.message);
  }
}
