// lib/entidades.js
//
// Busca a lista oficial de entidades credenciadas no site do TJDFT
// (Edital de Chamamento nº 2/2024) e sincroniza com a aba
// "Entidades_Credenciadas" da planilha SIGNU_DB.
//
// A página do TJDFT só publica os NOMES na ordem da fila — não há
// CNPJ, endereço, contato, e-mail nem data. Por isso a sincronização
// é um UPSERT por número de ordem (ID): atualiza o nome, adiciona
// entidades novas e PRESERVA os campos preenchidos à mão no sistema.

import { getSheet } from '@/lib/googleSheets';

export const URL_TJDFT =
  'https://www.tjdft.jus.br/transparencia/gestao-patrimonial-e-infraestrutura/bens-e-patrimonios/desfazimento/doacoes/credenciamento/lista-de-entidades-credenciadas-edital-de-chamamento-no-2-2024';

const SHEET = 'Entidades_Credenciadas';

/**
 * Baixa o HTML da página e extrai a lista numerada de entidades.
 * @returns {Promise<{ordem:number, nome:string}[]>}
 */
export async function buscarEntidadesTJDFT() {
  const resp = await fetch(URL_TJDFT, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SIGNU/1.0)' },
    cache: 'no-store',
  });
  if (!resp.ok) {
    throw new Error(`TJDFT respondeu ${resp.status} ao buscar a lista de entidades.`);
  }
  const html = await resp.text();
  return parseEntidades(html);
}

/** Extrai [{ordem, nome}] do HTML da página do TJDFT. Exportado para teste. */
export function parseEntidades(html) {
  const texto = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/ /g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');

  const vistos = new Map();
  for (const linha of texto.split('\n')) {
    const m = linha.trim().replace(/\s+/g, ' ').match(/^(\d{1,3})\.\s+(\D.{3,150})$/);
    if (!m) continue;
    const ordem = Number(m[1]);
    const nome = m[2].trim();
    if (ordem < 1 || ordem > 300) continue;
    // nome precisa ter letras de sobra — descarta numerações espúrias (ex.: subitens do edital)
    if (!/[A-Za-zÀ-ÿ]{4}/.test(nome)) continue;
    if (!vistos.has(ordem)) vistos.set(ordem, nome);
  }

  const lista = [...vistos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ordem, nome]) => ({ ordem, nome }));

  if (lista.length < 20) {
    throw new Error(
      `Só ${lista.length} entidades reconhecidas na página do TJDFT — o layout provavelmente mudou. Sincronização abortada.`
    );
  }
  return lista;
}

/**
 * Sincroniza a aba Entidades_Credenciadas com a lista do TJDFT.
 * UPSERT por ID (número de ordem): atualiza nome, adiciona novas,
 * preserva CNPJ/endereço/contato/e-mail/status/observações já cadastrados.
 * @param {{dryRun?:boolean}} [opts]
 */
export async function sincronizarEntidades({ dryRun = false } = {}) {
  const oficiais = await buscarEntidadesTJDFT();
  const sheet = await getSheet(SHEET);
  const rows = await sheet.getRows();

  const porId = new Map(rows.map((r) => [String(r.get('ID') || '').trim(), r]));

  const adicionadas = [];
  const atualizadas = [];
  let inalteradas = 0;
  const novas = [];

  for (const { ordem, nome } of oficiais) {
    const row = porId.get(String(ordem));
    if (!row) {
      novas.push({
        ID: String(ordem),
        ENTIDADE: nome,
        CNPJ: '', ENDERECO: '', CONTATO: '', EMAIL: '',
        STATUS: 'CREDENCIADA',
        DATA_CREDENCIAMENTO: '',
        OBSERVACOES: '',
      });
      adicionadas.push(`${ordem}. ${nome}`);
    } else if (String(row.get('ENTIDADE') || '').trim() !== nome) {
      atualizadas.push(`${ordem}. ${row.get('ENTIDADE')} → ${nome}`);
      if (!dryRun) {
        row.set('ENTIDADE', nome);
        await row.save();
      }
    } else {
      inalteradas++;
    }
  }

  if (!dryRun && novas.length) {
    await sheet.addRows(novas, { raw: true });
  }

  const idsOficiais = new Set(oficiais.map((e) => String(e.ordem)));
  const extras = rows
    .map((r) => String(r.get('ID') || '').trim())
    .filter((id) => id && !idsOficiais.has(id))
    .map((id) => `ID ${id}`);

  return { total: oficiais.length, adicionadas, atualizadas, inalteradas, extras };
}
