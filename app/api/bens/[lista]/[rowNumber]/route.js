// app/api/bens/[lista]/[rowNumber]/route.js
//
// GET    /api/bens/[lista]/[rowNumber]  -> busca um item específico (usado na tela Detalhes)
// PATCH  /api/bens/[lista]/[rowNumber]  -> edita campos específicos (Salvar Edição)
// DELETE /api/bens/[lista]/[rowNumber]  -> remove item (usado internamente nas transições)

import { NextResponse } from 'next/server';
import { getAllRows, updateRow, deleteRow } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';

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

    // Registra data/hora da última análise pelo servidor (usado nas notificações)
    const payload = {
      ...body,
      ULTIMA_ANALISE: new Date().toISOString(),
    };

    const itemAtualizado = await updateRow(sheetName, Number(rowNumber), payload);

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
