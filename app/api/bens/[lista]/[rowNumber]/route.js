// app/api/bens/[lista]/[rowNumber]/route.js
//
// GET    /api/bens/[lista]/[rowNumber]  -> busca um item específico (usado na tela Detalhes)
// PATCH  /api/bens/[lista]/[rowNumber]  -> edita campos específicos (Salvar Edição)
// DELETE /api/bens/[lista]/[rowNumber]  -> remove item (usado internamente nas transições)

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getAllRows, updateRow, deleteRow } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';
import { getNomePorEmail } from '@/lib/servidores';
import { registrarHistorico, diffCampos } from '@/lib/historico';

export async function GET(request, { params }) {
  try {
    const { lista, rowNumber } = await params;
    const sheetName = resolveSheetName(lista);
    const rows = await getAllRows(sheetName);
    const item = rows.find((r) => String(r._rowNumber) === String(rowNumber));

    if (!item) {
      return NextResponse.json({ erro: 'Item não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ lista: sheetName, item });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { lista, rowNumber } = await params;
    const sheetName = resolveSheetName(lista);
    const body = await request.json();

    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const autor = getNomePorEmail(token?.email) || 'Desconhecido';

    // Snapshot do estado ANTES da edição, pra registrar o que de fato mudou
    // no log de auditoria (base pro relatório de produtividade por servidor).
    const rowsAntes = await getAllRows(sheetName);
    const itemAntes = rowsAntes.find((r) => String(r._rowNumber) === String(rowNumber));

    // Registra data/hora da última análise e quem editou (usado nas notificações
    // e no histórico/produtividade)
    const payload = {
      ...body,
      ULTIMA_ANALISE: new Date().toISOString(),
      MODIFICADO_POR: autor,
    };

    const itemAtualizado = await updateRow(sheetName, Number(rowNumber), payload);

    const camposAlterados = diffCampos(itemAntes, body);
    if (Object.keys(camposAlterados).length > 0) {
      await registrarHistorico({
        lista, rowNumber, autor,
        itemId: itemAtualizado.ID_PASEI || itemAtualizado.PA || itemAtualizado.PJE || '',
        acao: 'EDITADO',
        camposAlterados,
      });
    }

    return NextResponse.json({ lista: sheetName, item: itemAtualizado });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { lista, rowNumber } = await params;
    const sheetName = resolveSheetName(lista);

    await deleteRow(sheetName, Number(rowNumber));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}
