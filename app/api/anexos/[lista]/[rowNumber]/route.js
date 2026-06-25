// app/api/anexos/[lista]/[rowNumber]/route.js
//
// GET    /api/anexos/[lista]/[rowNumber]           → lista arquivos do bem
// POST   /api/anexos/[lista]/[rowNumber]           → upload de arquivo (FormData)
// DELETE /api/anexos/[lista]/[rowNumber]?id=fileId → remove arquivo do Drive

import { NextResponse } from 'next/server';
import { listarAnexos, uploadAnexo, deletarAnexo } from '@/lib/googleDrive';

export async function GET(_req, { params }) {
  try {
    const { lista, rowNumber } = await params;
    const arquivos = await listarAnexos({ lista, rowNumber });
    return NextResponse.json({ arquivos });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { lista, rowNumber } = await params;
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ erro: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const bytes   = await file.arrayBuffer();
    const buffer  = Buffer.from(bytes);

    const resultado = await uploadAnexo({
      lista,
      rowNumber,
      nome:     file.name,
      mimeType: file.type || 'application/octet-stream',
      buffer,
    });

    return NextResponse.json({ arquivo: resultado }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId) {
      return NextResponse.json({ erro: 'Parâmetro ?id= obrigatório.' }, { status: 400 });
    }

    await deletarAnexo(fileId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
}
