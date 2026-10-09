// app/api/hora/route.js
//
// GET /api/hora -> { agora: ISO } — hora do SERVIDOR. Usada p/ carimbar as
// anotações das observações: o relógio do computador do usuário pode estar
// errado (caso real 2026-10-07: notas gravadas às 17h38 saíram como 07h58).

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ agora: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
