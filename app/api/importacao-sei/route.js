// app/api/importacao-sei/route.js
//
// Staging da automação SEI (automacao-sei/README.md, "passo 2"). O script
// Python roda fora do navegador — não tem sessão do NextAuth — então esta
// rota fica de fora do middleware (ver matcher em middleware.ts) e faz a
// própria autenticação:
//   POST -> token compartilhado (header x-import-token), usado pelo script
//   GET  -> sessão de gestor (igual às telas /gestao), usado pela tela de revisão
//
// POST /api/importacao-sei                    -> cria 1 item de staging (extrair_sei.py --enviar)
// GET  /api/importacao-sei?status=PENDENTE     -> lista itens de staging (tela de revisão)

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getAllRows, addRow } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';

// Mesma lista de e-mails gestores do middleware.ts — mantenha as duas em sincronia.
const GESTORES = [
  'danieldeandrade.pessoal@gmail.com',
  'carlosalex1318@gmail.com',
];

async function exigirGestor(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const email = (token?.email || '').toLowerCase();
  if (!token || !GESTORES.includes(email)) {
    return NextResponse.json({ erro: 'Acesso restrito a gestores.' }, { status: 403 });
  }
  return null;
}

export async function POST(request) {
  try {
    const tokenHeader = request.headers.get('x-import-token') || '';
    const tokenEsperado = process.env.SEI_IMPORT_TOKEN || '';
    if (!tokenEsperado || tokenHeader !== tokenEsperado) {
      return NextResponse.json({ erro: 'Token inválido.' }, { status: 401 });
    }

    const body = await request.json();
    const { processo, lista, campos, confianca, infoseg, texto_marcador, campos_incertos, alertas, fonte_url } = body;
    if (!lista || !campos) {
      return NextResponse.json({ erro: 'Campos obrigatórios: lista, campos.' }, { status: 400 });
    }

    const sheetName = resolveSheetName('importacao_sei');
    const item = await addRow(sheetName, {
      PROCESSO_SEI: processo || '',
      LISTA_DESTINO: lista,
      CAMPOS_JSON: JSON.stringify(campos || {}),
      CONFIANCA: confianca ?? '',
      INFOSEG: infoseg ? 'TRUE' : 'FALSE',
      TEXTO_MARCADOR: texto_marcador || '',
      CAMPOS_INCERTOS: Array.isArray(campos_incertos) ? campos_incertos.join(' ; ') : '',
      ALERTAS: Array.isArray(alertas) ? alertas.join(' ; ') : '',
      URL_SEI: fonte_url || '',
      STATUS_REVISAO: 'PENDENTE',
      DATA_IMPORTACAO: new Date().toISOString(),
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}

export async function GET(request) {
  try {
    const negado = await exigirGestor(request);
    if (negado) return negado;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const sheetName = resolveSheetName('importacao_sei');
    let rows = await getAllRows(sheetName);
    if (status) rows = rows.filter(r => (r.STATUS_REVISAO || 'PENDENTE') === status);

    const dados = rows.map(r => ({ ...r, campos: safeParse(r.CAMPOS_JSON) }));
    return NextResponse.json({ total: dados.length, dados });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}

function safeParse(json) {
  try { return JSON.parse(json || '{}'); } catch { return {}; }
}
