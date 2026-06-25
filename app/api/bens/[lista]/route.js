// app/api/bens/[lista]/route.js
//
// GET  /api/bens/[lista]                  -> lista todos os itens da lista
// GET  /api/bens/[lista]?atribuidoA=Nome  -> filtra por campo Responsavel (usado na "Minha Fila")
// POST /api/bens/[lista]                  -> cria novo item (usado no Cadastro)

import { NextResponse } from 'next/server';
import { getAllRows, addRow } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';

export async function GET(request, { params }) {
  try {
    const { lista } = await params;
    const sheetName = resolveSheetName(lista);
    const { searchParams } = new URL(request.url);
    const atribuidoA = searchParams.get('atribuidoA');

    let rows = await getAllRows(sheetName);

    if (atribuidoA) {
      const query = atribuidoA.toLowerCase();
      rows = rows.filter((row) => {
        // Tenta vários nomes possíveis de coluna
        const resp = (
          row.RESPONSAVEL || row.Responsavel || row.responsavel ||
          row.SERVIDOR || row.ATRIBUIDO_A || row.RESPONSAVEL_DILIGENCIA || ''
        ).toLowerCase();
        // Match bidirecional: "carla araújo" bate "carla" e vice-versa
        return resp && (resp.includes(query) || query.includes(resp));
      });
    }

    return NextResponse.json({ lista: sheetName, total: rows.length, dados: rows });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}

export async function POST(request, { params }) {
  try {
    const { lista } = await params;
    const sheetName = resolveSheetName(lista);
    const body = await request.json();

    const novoItem = await addRow(sheetName, body);

    return NextResponse.json({ lista: sheetName, item: novoItem }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}
