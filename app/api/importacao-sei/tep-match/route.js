// app/api/importacao-sei/tep-match/route.js
//
// GET /api/importacao-sei/tep-match?niv=...&placa=...&renavam=...
//
// Busca em Bens_PCDF_1HIGEIA e Bens_PCDF_2HIGEIA por um veículo já cadastrado
// que bata com o NIV, placa ou RENAVAM extraídos de um retorno de TEP/CEB/TIV
// da PCDF (ver automacao-sei/extrair_sei.py, campo EH_RETORNO_TEP). Usado pela
// tela de revisão pra achar o cadastro existente a atualizar, sem depender do
// nº do processo SEI (o retorno tem um nº novo, diferente do cadastro original).
//
// Protegida por sessão de gestor (mesmo padrão das outras rotas de importacao-sei).

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getAllRows } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';

const GESTORES = [
  'danieldeandrade.pessoal@gmail.com',
  'carlosalex1318@gmail.com',
];

const norm = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normDigitos = (v) => String(v || '').replace(/\D/g, '');

export async function GET(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const email = (token?.email || '').toLowerCase();
    if (!token || !GESTORES.includes(email)) {
      return NextResponse.json({ erro: 'Acesso restrito a gestores.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const niv = norm(searchParams.get('niv'));
    const placa = norm(searchParams.get('placa'));
    const renavam = normDigitos(searchParams.get('renavam'));

    if (!niv && !placa && !renavam) {
      return NextResponse.json({ erro: 'Informe ao menos niv, placa ou renavam.' }, { status: 400 });
    }

    const candidatos = [];
    for (const lista of ['pcdf1', 'pcdf2']) {
      const rows = await getAllRows(resolveSheetName(lista));
      for (const r of rows) {
        const bateNiv = niv && niv !== 'NA' && norm(r.NIV) === niv;
        const batePlaca = placa && (norm(r.PLACA) === placa || norm(r.PLACA_OSTENTADA) === placa);
        const bateRenavam = renavam && normDigitos(r.RENAVAM) === renavam;
        if (bateNiv || batePlaca || bateRenavam) {
          candidatos.push({
            lista,
            rowNumber: r._rowNumber,
            ID_PASEI: r.ID_PASEI,
            TIPO_BEM: r.TIPO_BEM,
            MARCA_MODELO: r.MARCA_MODELO,
            NIV: r.NIV,
            PLACA: r.PLACA,
            PLACA_OSTENTADA: r.PLACA_OSTENTADA,
            RENAVAM: r.RENAVAM,
            RESPONSAVEL: r.Responsavel || r.RESPONSAVEL,
            STATUS_DILIGENCIA: r.STATUS_DILIGENCIA,
            CEB_TEP_TIV: r.CEB_TEP_TIV,
            TEP_SEI: r.TEP_SEI,
            criterioMatch: [bateNiv && 'NIV', batePlaca && 'PLACA', bateRenavam && 'RENAVAM'].filter(Boolean).join('+'),
          });
        }
      }
    }

    return NextResponse.json({ total: candidatos.length, candidatos });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}
