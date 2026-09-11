// app/api/importacao-sei/[rowNumber]/route.js
//
// PATCH /api/importacao-sei/[rowNumber]
//   body { acao:"promover", campos:{...} }  -> cria a linha de verdade na lista
//     de destino (com os campos já conferidos/editados pelo gestor) e marca
//     este item de staging como PROMOVIDO.
//   body { acao:"descartar" }               -> marca como DESCARTADO (não apaga,
//     fica no histórico).
//
// Protegida por sessão de gestor (mesmo padrão de /api/importacao-sei GET).

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getAllRows, addRow, updateRow } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';

const GESTORES = [
  'danieldeandrade.pessoal@gmail.com',
  'carlosalex1318@gmail.com',
];

export async function PATCH(request, { params }) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const email = (token?.email || '').toLowerCase();
    if (!token || !GESTORES.includes(email)) {
      return NextResponse.json({ erro: 'Acesso restrito a gestores.' }, { status: 403 });
    }

    const { rowNumber } = await params;
    const body = await request.json();
    const sheetStaging = resolveSheetName('importacao_sei');

    const linhas = await getAllRows(sheetStaging);
    const staging = linhas.find(r => String(r._rowNumber) === String(rowNumber));
    if (!staging) {
      return NextResponse.json({ erro: 'Item de importação não encontrado.' }, { status: 404 });
    }

    if (body.acao === 'descartar') {
      const item = await updateRow(sheetStaging, Number(rowNumber), { STATUS_REVISAO: 'DESCARTADO' });
      return NextResponse.json({ item });
    }

    if (body.acao === 'promover') {
      if (staging.STATUS_REVISAO === 'PROMOVIDO') {
        return NextResponse.json({ erro: 'Este item já foi promovido.' }, { status: 400 });
      }
      const sheetDestino = resolveSheetName(staging.LISTA_DESTINO);
      const campos = body.campos || {};
      const novoItem = await addRow(sheetDestino, campos);

      const staged = await updateRow(sheetStaging, Number(rowNumber), {
        STATUS_REVISAO: 'PROMOVIDO',
        PROMOVIDO_EM: new Date().toISOString(),
        LISTA_ROW_PROMOVIDA: String(novoItem._rowNumber),
      });
      return NextResponse.json({ item: staged, promovido: novoItem });
    }

    return NextResponse.json({ erro: 'Ação inválida. Use "promover" ou "descartar".' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}
