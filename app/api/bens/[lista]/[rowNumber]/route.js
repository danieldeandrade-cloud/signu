// app/api/bens/[lista]/[rowNumber]/route.js
//
// GET    /api/bens/[lista]/[rowNumber]  -> busca um item específico (usado na tela Detalhes)
// PATCH  /api/bens/[lista]/[rowNumber]  -> edita campos específicos (Salvar Edição)
// DELETE /api/bens/[lista]/[rowNumber]  -> remove item (usado internamente nas transições)

import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getAllRows, updateRow, deleteRow } from '@/lib/googleSheets';
import { resolveSheetName } from '@/lib/listas';
import { getNomePorEmail } from '@/lib/servidores';
import { registrarHistorico, diffCampos } from '@/lib/historico';
import { reorganizarFilaDoacoes } from '@/lib/reorganizarFilaDoacoes';
import { acharLoteEmOutroPa, mensagemLoteOutroPa } from '@/lib/duplicidadeLote';
import { statusHigeiaPara } from '@/lib/statusReciclagem';
import { acharDuplicadoVeiculo, mensagemDuplicado, LISTAS_VEICULO } from '@/lib/duplicidadeVeiculo';

export async function GET(request, { params }) {
  try {
    const { lista, rowNumber } = await params;
    const sheetName = resolveSheetName(lista);
    const rows = await getAllRows(sheetName);
    const item = rows.find((r) => String(r._rowNumber) === String(rowNumber));

    if (!item) {
      return NextResponse.json({ erro: 'Item não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ lista: sheetName, item });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { lista, rowNumber } = await params;
    const sheetName = resolveSheetName(lista);
    const { _verificacaoId, _rowNumber: rowDoItem, ...body } = await request.json();

    // Trava 2 (2026-10-13): a tela manda o _rowNumber do item que ela tinha
    // carregado. Se não bate com a linha da URL, a tela estava mostrando OUTRO
    // item (ex.: trocou de item do mesmo lote antes de terminar de carregar) —
    // e itens do mesmo lote DPJ têm o mesmo PA, então _verificacaoId não
    // percebia. Caso real: 08/10, lote 4774, geladeira gravada por cima da
    // lava-louças.
    if (rowDoItem !== undefined && rowDoItem !== null && String(rowDoItem) !== String(rowNumber)) {
      return NextResponse.json(
        { erro: 'A tela estava mostrando outro item (a página mudou de item antes de salvar). Nada foi gravado — recarregue a página e refaça a edição.' },
        { status: 409 }
      );
    }

    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const autor = getNomePorEmail(token?.email) || 'Desconhecido';

    // Snapshot do estado ANTES da edição, pra registrar o que de fato mudou
    // no log de auditoria (base pro relatório de produtividade por servidor).
    const rowsAntes = await getAllRows(sheetName);
    const itemAntes = rowsAntes.find((r) => String(r._rowNumber) === String(rowNumber));

    if (!itemAntes) {
      return NextResponse.json(
        { erro: 'Item não encontrado nessa linha — pode ter sido removido ou a lista mudou. Recarregue a página e tente de novo.' },
        { status: 409 }
      );
    }

    // Trava de segurança: o SIGNU identifica os itens pelo número da linha na
    // planilha, não por um ID fixo. Se essa linha mudou de posição entre a
    // tela abrir e o Salvar (outra edição/remoção deslocou tudo embaixo),
    // salvar aqui sobrescreveria silenciosamente um item DIFERENTE — já
    // aconteceu ao vivo em 2026-09-24 (edição de um item apagou outro sem
    // nenhum aviso). _verificacaoId é o identificador do item no momento em
    // que a tela abriu (mandado pelo cliente, nunca editado pelo formulário);
    // se não bater com quem está na linha agora, recusa em vez de arriscar.
    if (_verificacaoId) {
      const campoId = lista === 'dpj' ? (itemAntes.PA || itemAntes.PA_PJE) : itemAntes.ID_PASEI;
      if (String(campoId || '').trim() && String(_verificacaoId).trim() !== String(campoId).trim()) {
        return NextResponse.json(
          { erro: 'Este item mudou de posição na planilha desde que a página foi carregada. Recarregue e tente de novo — evita sobrescrever outro registro por engano.' },
          { status: 409 }
        );
      }
    }

    // Trocar PA/NIV para os de um veículo que já está em outra lista de veículos
    // criaria duplicidade (ver lib/duplicidadeVeiculo.js) — só checa se mudou.
    if (LISTAS_VEICULO.includes(lista)) {
      const mudouPa  = 'ID_PASEI' in body && String(body.ID_PASEI || '').trim() !== String(itemAntes.ID_PASEI || '').trim();
      const mudouNiv = 'NIV' in body && String(body.NIV || '').trim() !== String(itemAntes.NIV || '').trim();
      if (mudouPa || mudouNiv) {
        const dup = await acharDuplicadoVeiculo(
          { ID_PASEI: mudouPa ? body.ID_PASEI : '', NIV: mudouNiv ? body.NIV : '' },
          { ignorar: [{ lista, rowNumber: Number(rowNumber) }] }
        );
        if (dup) return NextResponse.json({ erro: mensagemDuplicado(dup) }, { status: 409 });
      }
    }

    // DPJ-GC99: trocar o LOTE ou o PA não pode deixar o mesmo lote em PAs diferentes
    // (só confere se um dos dois mudou — itens antigos continuam editáveis)
    if (lista === 'dpj') {
      const novoLote = 'LOTE' in body ? body.LOTE : itemAntes.LOTE;
      const novoPa = ('PA' in body ? body.PA : undefined) ?? ('PA_PJE' in body ? body.PA_PJE : undefined) ?? (itemAntes.PA || itemAntes.PA_PJE);
      const mudou = String(novoLote || '').trim() !== String(itemAntes.LOTE || '').trim() ||
        String(novoPa || '').replace(/\D/g, '') !== String(itemAntes.PA || itemAntes.PA_PJE || '').replace(/\D/g, '');
      if (mudou) {
        const dados = { LOTE: novoLote, PA: novoPa };
        const outro = await acharLoteEmOutroPa(dados, { ignorarRow: rowNumber });
        if (outro) return NextResponse.json({ erro: mensagemLoteOutroPa(dados, outro) }, { status: 409 });
      }
    }

    // VISTO_EM não vem da tela (lib/googleSheets.updateRow cuida) — fora do
    // diff p/ o histórico não registrar o valor velho que a tela reenviava
    delete body.VISTO_EM;

    // Reciclagem em diligência = "EM DILIGÊNCIA HIGEIA" — aplica já aqui p/ o
    // histórico registrar o valor que de fato vai p/ a planilha
    const higeia = statusHigeiaPara(lista, body, itemAntes);
    if (higeia) body.STATUS_DILIGENCIA = higeia;

    // Registra data/hora da última análise e quem editou (usado nas notificações
    // e no histórico/produtividade)
    const payload = {
      ...body,
      ULTIMA_ANALISE: new Date().toISOString(),
      MODIFICADO_POR: autor,
    };

    const itemAtualizado = await updateRow(sheetName, Number(rowNumber), payload);

    const camposAlterados = diffCampos(itemAntes, body);
    if (Object.keys(camposAlterados).length > 0) {
      await registrarHistorico({
        lista, rowNumber, autor,
        itemId: itemAtualizado.ID_PASEI || itemAtualizado.PA || itemAtualizado.PJE || '',
        acao: 'EDITADO',
        camposAlterados,
      });
    }

    if (lista === 'doacoes_diligencia') await reorganizarFilaDoacoes();

    return NextResponse.json({ lista: sheetName, item: itemAtualizado });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { lista, rowNumber } = await params;
    const sheetName = resolveSheetName(lista);

    await deleteRow(sheetName, Number(rowNumber));
    if (lista === 'doacoes_diligencia') await reorganizarFilaDoacoes();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }
}
