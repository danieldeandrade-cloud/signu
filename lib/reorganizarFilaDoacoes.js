// lib/reorganizarFilaDoacoes.js
//
// Server-side: depois de qualquer escrita que mexa na fila de doações
// (novo lote, edição, remoção, anotação de recusa), regrava a ENTIDADE_NOME
// dos lotes PENDENTES (status vazio + sem responsável) com a entidade prevista
// pela posição — ver lib/filaDoacoes.js. Lotes em andamento/concluídos nunca
// são tocados. Usa setCampoSemRastro: não é trabalho de ninguém, não deve
// mexer em DATA_ATUALIZACAO/MODIFICADO_POR.

import { getAllRows, setCampoSemRastro } from './googleSheets';
import { resolveSheetName } from './listas';
import { montarFilaDoacoes } from './filaDoacoes';
import { registrarHistorico } from './historico';

export async function reorganizarFilaDoacoes() {
  try {
    const sheetDoacoes = resolveSheetName('doacoes_diligencia');
    const [doacoes, entidades, anotacoes] = await Promise.all([
      getAllRows(sheetDoacoes),
      getAllRows(resolveSheetName('entidades')),
      getAllRows(resolveSheetName('anotacoes_doacoes')),
    ]);
    const nomes = entidades
      .filter(e => e.ID && e.ENTIDADE)
      .sort((a, b) => Number(a.ID) - Number(b.ID))
      .map(e => `${e.ID}. ${e.ENTIDADE}`);
    if (nomes.length < 20) return; // aba de entidades vazia/quebrada — não arrisca

    const { ajustes } = montarFilaDoacoes(doacoes, nomes, anotacoes);
    for (const a of ajustes) {
      await setCampoSemRastro(sheetDoacoes, a._rowNumber, 'ENTIDADE_NOME', a.para);
      const item = doacoes.find(d => d._rowNumber === a._rowNumber);
      await registrarHistorico({
        lista: 'doacoes_diligencia', rowNumber: a._rowNumber, autor: 'Sistema (fila de doações)',
        itemId: item?.ID_PASEI || '', acao: 'FILA_REORGANIZADA',
        camposAlterados: { ENTIDADE_NOME: { de: a.de, para: a.para } },
      });
    }
  } catch (e) {
    // Nunca derruba a escrita principal por causa da reorganização
    console.error('[filaDoacoes] falha ao reorganizar:', e.message);
  }
}
