// app/api/entidades/route.js
//
// GET  /api/entidades          → lista as entidades credenciadas (aba Entidades_Credenciadas)
// POST /api/entidades          → sincroniza a aba com a lista oficial do TJDFT
// POST /api/entidades?dryRun=1 → simula a sincronização sem gravar
//
// Fonte oficial: Edital de Chamamento nº 2/2024 (site do TJDFT) — ver lib/entidades.js

import { NextResponse } from 'next/server';
import { getAllRows } from '@/lib/googleSheets';
import { sincronizarEntidades, URL_TJDFT } from '@/lib/entidades';

export async function GET() {
  try {
    const rows = await getAllRows('Entidades_Credenciadas');
    rows.sort((a, b) => (Number(a.ID) || 0) - (Number(b.ID) || 0));
    return NextResponse.json({ total: rows.length, dados: rows, fonte: URL_TJDFT });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
    const resultado = await sincronizarEntidades({ dryRun });
    return NextResponse.json({
      ok: true,
      dryRun,
      ...resultado,
      resumo:
        `${resultado.total} na lista oficial · ` +
        `${resultado.adicionadas.length} adicionada(s) · ` +
        `${resultado.atualizadas.length} atualizada(s) · ` +
        `${resultado.inalteradas} sem mudança` +
        (resultado.extras.length ? ` · ${resultado.extras.length} fora da lista oficial` : ''),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 502 });
  }
}
