// app/api/anotacoes/route.js
//
// GET  /api/anotacoes  → lista todas as anotações de doações não realizadas
// POST /api/anotacoes  → registra nova anotação de recusa/motivo
//
// Colunas da aba "Anotacoes_Doacoes" na planilha SIGNU_DB:
//   DATA          — data/hora do registro (gerado automaticamente)
//   ENTIDADE      — nome da entidade que recusou/não houve interesse
//   MOTIVO        — motivo da não realização
//   BEM_VINCULADO — ID do bem que foi oferecido (opcional)
//   OBSERVACOES   — anotações livres

import { NextResponse } from 'next/server';
import { getAllRows, addRow } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';

const SHEET = 'anotacoes_doacoes';

export async function GET() {
  try {
    const sheetName = resolveSheetName(SHEET);
    const rows = await getAllRows(sheetName);
    return NextResponse.json({ total: rows.length, dados: rows });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { entidade, motivo, bemVinculado, observacoes } = body;

    if (!entidade || !motivo) {
      return NextResponse.json(
        { erro: 'Campos obrigatórios: entidade, motivo' },
        { status: 400 }
      );
    }

    const sheetName = resolveSheetName(SHEET);
    const timestamp = new Date().toLocaleString('pt-BR');

    const novaLinha = await addRow(sheetName, {
      DATA:          timestamp,
      ENTIDADE:      entidade,
      MOTIVO:        motivo,
      BEM_VINCULADO: bemVinculado || '',
      OBSERVACOES:   observacoes  || '',
    });

    return NextResponse.json({ anotacao: novaLinha }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}
