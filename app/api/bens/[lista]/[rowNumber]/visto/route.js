// app/api/bens/[lista]/[rowNumber]/visto/route.js
//
// POST /api/bens/[lista]/[rowNumber]/visto
//
// Marca o item como visto pelo responsável ATUAL (limpa o selo "🆕 Novo" na
// Minha Fila). Só grava se quem está logado é de fato o RESPONSAVEL do item —
// um gestor ou outro servidor abrindo o item não conta como "visto" pra quem
// é dono dele. Usa setCampoSemRastro (não updateRow) de propósito: abrir um
// item não é uma edição de dado, não deve mexer em DATA_ATUALIZACAO (mascararia
// itens realmente parados) nem em MODIFICADO_POR (não deve virar evento de
// produtividade no Historico_Alteracoes).

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getAllRows, setCampoSemRastro } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';
import { getNomePorEmail } from '@/lib/servidores';

export async function POST(request, { params }) {
  try {
    const { lista, rowNumber } = await params;
    const sheetName = resolveSheetName(lista);

    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const nome = getNomePorEmail(token?.email);
    if (!token || !nome) {
      return NextResponse.json({ ok: false, motivo: 'sem sessão' }, { status: 401 });
    }

    const rows = await getAllRows(sheetName);
    const item = rows.find((r) => String(r._rowNumber) === String(rowNumber));
    if (!item) {
      return NextResponse.json({ erro: 'Item não encontrado' }, { status: 404 });
    }

    const responsavel = (item.RESPONSAVEL || item.Responsavel || '').trim();
    if (responsavel !== nome) {
      return NextResponse.json({ ok: false, motivo: 'não é o responsável deste item' });
    }

    await setCampoSemRastro(sheetName, Number(rowNumber), 'VISTO_EM', new Date().toISOString());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}
