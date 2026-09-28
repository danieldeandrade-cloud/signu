// app/api/cron/prazo-dpj/route.js
//
// Chamado pelo Vercel Cron Job (seg–sex às 10h UTC, mesmo horário do
// /api/notificacoes — ver vercel.json).
//
// Regra do NULEJ: todo item novo da DPJ-GC99 nasce em STATUS_DILIGENCIA =
// "PRAZO 6 MESES" (ver app/cadastro/page.jsx) — dentro do prazo de 180 dias
// da entrada, o NULEJ ainda não precisa diligenciar. Esta rota varre
// Bens_DPJ_GC99 e promove sozinho pra "EM DILIGÊNCIA" todo item que:
//   - ainda está em STATUS_DILIGENCIA === "PRAZO 6 MESES"
//   - e cuja DATA_ENTRADA + 180 dias já passou
// Itens que o gestor já moveu manualmente pra outro status (LPC, RETIRADO,
// DOAÇÃO EM ANDAMENTO etc.) não são tocados — só o caminho automático
// "PRAZO 6 MESES" → "EM DILIGÊNCIA".
//
// Acionar manualmente: GET /api/cron/prazo-dpj?secret=CRON_SECRET

import { NextResponse } from 'next/server';
import { getAllRows, updateRow } from '@/lib/googleSheets';

const SHEET = 'Bens_DPJ_GC99';
const PRAZO_DIAS = 180;

// Converte data (ISO aaaa-mm-dd ou dd/mm/aaaa) em ms; null se não der
function parseDataFlex(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  const d = new Date(s);
  return isNaN(d) ? null : d.getTime();
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization') || '';
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  const autorizado =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (cronSecret && querySecret === cronSecret);

  if (!autorizado) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  }

  try {
    const agora = Date.now();
    const rows = await getAllRows(SHEET);
    const promovidos = [];

    for (const r of rows) {
      const status = String(r.STATUS_DILIGENCIA || '').trim().toUpperCase();
      if (status !== 'PRAZO 6 MESES') continue;

      const entrada = parseDataFlex(r.DATA_ENTRADA);
      if (!entrada) continue;

      const diasPassados = Math.floor((agora - entrada) / 86400000);
      if (diasPassados < PRAZO_DIAS) continue;

      await updateRow(SHEET, r._rowNumber, {
        STATUS_DILIGENCIA: 'EM DILIGÊNCIA',
        MODIFICADO_POR: 'Sistema (prazo 6 meses vencido)',
      });
      promovidos.push({
        rowNumber: r._rowNumber,
        LOTE: r.LOTE,
        PA: r.PA || r.PA_PJE,
        DATA_ENTRADA: r.DATA_ENTRADA,
        diasPassados,
      });
    }

    return NextResponse.json({ ok: true, totalVarridos: rows.length, promovidos });
  } catch (e) {
    return NextResponse.json({ erro: e.message }, { status: 500 });
  }
}
