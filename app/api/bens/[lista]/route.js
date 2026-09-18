// app/api/bens/[lista]/route.js
//
// GET  /api/bens/[lista]                  -> lista todos os itens da lista
// GET  /api/bens/[lista]?atribuidoA=Nome  -> filtra por campo Responsavel (usado na "Minha Fila")
// POST /api/bens/[lista]                  -> cria novo item (usado no Cadastro)

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getAllRows, addRow } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';
import { getNomePorEmail } from '@/lib/servidores';
import { registrarHistorico } from '@/lib/historico';

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

    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const autor = getNomePorEmail(token?.email) || 'Desconhecido';

    const novoItem = await addRow(sheetName, { ...body, MODIFICADO_POR: autor });

    await registrarHistorico({
      lista, rowNumber: novoItem._rowNumber, autor,
      itemId: novoItem.ID_PASEI || novoItem.PA || novoItem.PJE || '',
      acao: 'CRIADO',
      camposAlterados: {},
    });

    return NextResponse.json({ lista: sheetName, item: novoItem }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}
