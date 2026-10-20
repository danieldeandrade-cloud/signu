// app/api/parados/contexto/route.js
//
// GET /api/parados/contexto -> contexto da exceção de prazo "doação aguardando
// aptidão" (30 dias) usado pelas telas p/ calcular "parado" — ver lib/parados.js.
// Pequeno de propósito: a Minha Fila só carrega os itens do próprio servidor,
// mas a exceção cruza DPJ-GC99 × Doações (todos os responsáveis).

import { NextResponse } from 'next/server';
import { getAllRows } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';
import { contextoAptidao } from '@/lib/parados';

export async function GET() {
  try {
    const [doacoes, dpj] = await Promise.all([
      getAllRows(resolveSheetName('doacoes_diligencia')),
      getAllRows(resolveSheetName('dpj')),
    ]);
    return NextResponse.json(contextoAptidao(doacoes, dpj));
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}
