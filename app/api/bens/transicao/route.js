// app/api/bens/transicao/route.js
//
// POST /api/bens/transicao
// Body: { origem: 'cegoc', rowNumber: 12, destino: 'pcdf2' | 'catalogo', observacao: '...' }
//
// Implementa as Regras de Negócio 1 e 2 do documento original:
//   Regra 1 — CEGOC (DESTINACAO = 'EM DILIGÊNCIA HIGEIA') -> cria em PCDF_2HIGEIA,
//             só apaga da origem DEPOIS de confirmar a criação no destino.
//   Regra 2 — CEGOC (DESTINACAO = 'LPC') -> apenas atualiza DESTINACAO para 'CATÁLOGO',
//             o item permanece na mesma lista.

import { NextResponse } from 'next/server';
import { getAllRows, addRow, updateRow, deleteRow } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';

export async function POST(request) {
  try {
    const body = await request.json();
    const { origem, rowNumber, destino, observacao } = body;

    if (!origem || !rowNumber || !destino) {
      return NextResponse.json(
        { erro: 'Campos obrigatórios: origem, rowNumber, destino' },
        { status: 400 }
      );
    }

    const sheetOrigem = resolveSheetName(origem);
    const rows = await getAllRows(sheetOrigem);
    const item = rows.find((r) => String(r._rowNumber) === String(rowNumber));

    if (!item) {
      return NextResponse.json({ erro: 'Item de origem não encontrado' }, { status: 404 });
    }

    const timestamp = new Date().toLocaleString('pt-BR');

    // Regra 2 — LPC -> CATÁLOGO (permanece na mesma lista)
    if (destino === 'catalogo') {
      const itemAtualizado = await updateRow(sheetOrigem, Number(rowNumber), {
        DESTINACAO: 'CATÁLOGO',
        OBSERVACOES: `${item.OBSERVACOES || ''}\n[${timestamp}] Transição LPC -> CATÁLOGO. ${observacao || ''}`.trim(),
      });

      return NextResponse.json({ tipo: 'atualizacao_simples', item: itemAtualizado });
    }

    // Regra 1 — CEGOC -> PCDF 2ª HIGEIA (cria no destino antes de apagar na origem)
    if (destino === 'pcdf2') {
      const sheetDestino = resolveSheetName('pcdf2');

      // Remove metadados internos do google-spreadsheet antes de gravar na nova aba
      const { _rowNumber: _, ...dadosBem } = item;

      const novoItem = await addRow(sheetDestino, {
        ...dadosBem,
        ORIGEM_CEGOC_ID: item.ID_LEGADO || String(item._rowNumber),
        STATUS_DILIGENCIA: item.STATUS_DILIGENCIA || 'EM DILIGÊNCIA',
        DEPOSITO: item.DEPOSITO || 'SELAB/PCDF',
        OBSERVACOES: `${item.OBSERVACOES || ''}\n[${timestamp}] ${observacao || ''}`.trim(),
      });

      // Só apaga da origem depois de confirmar a criação no destino
      await deleteRow(sheetOrigem, Number(rowNumber));

      return NextResponse.json({ tipo: 'transicao_lista', item: novoItem });
    }

    return NextResponse.json({ erro: `Destino "${destino}" não reconhecido` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}
