/**
 * scripts/importar-entidades.mjs
 *
 * Popula a aba Entidades_Credenciadas com a lista oficial do TJDFT
 * (Edital de Chamamento nº 2/2024). Idempotente — faz upsert por ID.
 *
 *   node scripts/importar-entidades.mjs            # dry-run
 *   node scripts/importar-entidades.mjs --apply    # grava
 *
 * Para atualizações no dia a dia use o botão "Atualizar entidades (TJDFT)"
 * na tela de Doações (mesma lógica, via /api/entidades).
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const URL_TJDFT =
  'https://www.tjdft.jus.br/transparencia/gestao-patrimonial-e-infraestrutura/bens-e-patrimonios/desfazimento/doacoes/credenciamento/lista-de-entidades-credenciadas-edital-de-chamamento-no-2-2024';

const APPLY = process.argv.includes('--apply');
const __dir = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(__dir, '../.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

// Situação na fila de doação — extraída da aba "DOAÇÃO novo método" (coluna SITUAÇÃO DA DOAÇÃO)
const SITUACAO = {
  1: 'Transferiu o CNPJ a outra organização não credenciada junto ao TJDFT. Cadastro atualizado — CNPJ da entidade 1 (ID 4774403). Consultar PA 0000741/2024 - ID 4774457.',
  5: 'RECUSOU o bem — penalidade aplicada: vai para o fim da fila. PA 0024562/2023 - ID 4853527.',
  11: 'Entidade não localizada — deu-se sequência à próxima da lista (posição 12ª). Sem penalidade.',
  16: 'RECUSOU o bem — penalidade aplicada: vai para o fim da fila. PA 0022792/2021 - ID 5185016.',
};

function parseEntidades(html) {
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
    if (ordem < 1 || ordem > 300) continue;
    if (!/[A-Za-zÀ-ÿ]{4}/.test(m[2])) continue;
    if (!vistos.has(ordem)) vistos.set(ordem, m[2].trim());
  }
  return [...vistos.entries()].sort((a, b) => a[0] - b[0]).map(([ordem, nome]) => ({ ordem, nome }));
}

const resp = await fetch(URL_TJDFT, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SIGNU/1.0)' } });
if (!resp.ok) throw new Error(`TJDFT respondeu ${resp.status}`);
const oficiais = parseEntidades(await resp.text());
console.log(`\n📋 ${oficiais.length} entidades na lista oficial do TJDFT`);
if (oficiais.length < 40) throw new Error('Lista muito curta — layout mudou?');

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();
const sheet = doc.sheetsByTitle['Entidades_Credenciadas'];
await sheet.loadHeaderRow();
const rows = await sheet.getRows();
const porId = new Map(rows.map((r) => [String(r.get('ID') || '').trim(), r]));

const novas = [];
let atualizadas = 0;
for (const { ordem, nome } of oficiais) {
  const row = porId.get(String(ordem));
  const obs = SITUACAO[ordem] || '';
  if (!row) {
    novas.push({ ID: String(ordem), ENTIDADE: nome, CNPJ: '', ENDERECO: '', CONTATO: '', EMAIL: '', STATUS: 'CREDENCIADA', DATA_CREDENCIAMENTO: '', OBSERVACOES: obs });
  } else if (String(row.get('ENTIDADE') || '').trim() !== nome) {
    atualizadas++;
    if (APPLY) { row.set('ENTIDADE', nome); await row.save(); }
  }
}

console.log(APPLY ? '🚀 APLICAR' : '👁  DRY-RUN (use --apply)');
console.log(`   adicionar: ${novas.length}   atualizar nome: ${atualizadas}   já ok: ${oficiais.length - novas.length - atualizadas}`);
console.log('   amostra:', JSON.stringify(novas[0]), '...', JSON.stringify(novas[novas.length - 1]));
if (APPLY && novas.length) {
  await sheet.addRows(novas, { raw: true });
  console.log(`   💾 ${novas.length} linhas gravadas.`);
}
console.log(APPLY ? '✅ Concluído.' : '👁  Nada gravado.');
