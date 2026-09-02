// app/api/bens/transicao-lote/route.js
//
// POST /api/bens/transicao-lote
// Body: { origem: 'cegoc', rowNumbers: [12, 27, 41], destino: 'pcdf2', observacao: 'FIB enviada' }
//
// Migração em lote CEGOC -> PCDF 2ª HIGEIA. Mesma regra do /transicao (cria no
// destino antes de apagar na origem), porém:
//   - lê a origem UMA vez e resolve todos os itens desse snapshot;
//   - cria todos no destino; só então apaga da origem, em ordem decrescente de
//     linha (para os _rowNumber ainda não processados continuarem válidos).
// Se algum item falha ao ser criado, ele NÃO é apagado da origem (sem perda de dado).

import { NextResponse } from 'next/server';
import { getAllRows, addRow, deleteRow } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';

export async function POST(request) {
  try {
    const { origem, rowNumbers, destino, observacao } = await request.json();

    if (!origem || destino !== 'pcdf2' || !Array.isArray(rowNumbers) || rowNumbers.length === 0) {
      return NextResponse.json(
        { erro: 'Body esperado: { origem, rowNumbers: [...], destino: "pcdf2", observacao }' },
        { status: 400 }
      );
    }

    const sheetOrigem = resolveSheetName(origem);
    const sheetDestino = resolveSheetName('pcdf2');
    const alvoSet = new Set(rowNumbers.map(String));

    const rows = await getAllRows(sheetOrigem);
    const alvo = rows.filter((r) => alvoSet.has(String(r._rowNumber)));

    if (alvo.length === 0) {
      return NextResponse.json({ erro: 'Nenhum item de origem encontrado' }, { status: 404 });
    }

    const timestamp = new Date().toLocaleString('pt-BR');
    const justificativa = observacao || 'FIB enviada';
    const migrados = [];
    const falhas = [];

    // 1) cria todos no destino
    for (const item of alvo) {
      try {
        const { _rowNumber, ...dadosBem } = item;
        await addRow(sheetDestino, {
          ...dadosBem,
          ORIGEM_CEGOC_ID: item.ID_LEGADO || String(item._rowNumber),
          STATUS_DILIGENCIA: item.STATUS_DILIGENCIA || 'EM DILIGÊNCIA',
          DEPOSITO: item.DEPOSITO || 'SELAB/PCDF',
          DESTINACAO: 'RECICLAGEM',
          OBSERVACOES: `${item.OBSERVACOES || ''}\n[${timestamp}] ${justificativa}`.trim(),
        });
        migrados.push(item);
      } catch (e) {
        falhas.push({ rowNumber: item._rowNumber, id: item.ID_LEGADO || null, erro: e.message });
      }
    }

    // 2) apaga da origem só os que foram criados — linha mais alta primeiro
    const paraApagar = migrados.map((i) => Number(i._rowNumber)).sort((a, b) => b - a);
    for (const rn of paraApagar) {
      try {
        await deleteRow(sheetOrigem, rn);
      } catch (e) {
        falhas.push({ rowNumber: rn, erro: `criado no destino, mas não removido da origem: ${e.message}` });
      }
    }

    return NextResponse.json({
      ok: true,
      total: alvo.length,
      migrados: migrados.length,
      falhas,
    });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}
