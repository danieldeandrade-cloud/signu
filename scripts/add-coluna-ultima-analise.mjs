/**
 * scripts/add-coluna-ultima-analise.mjs
 *
 * Coluna-fantasma: a rota PATCH /api/bens/[lista]/[rowNumber] sempre manda
 * ULTIMA_ANALISE (timestamp ISO, é o que as telas exibem como "Última
 * atualização"), mas Bens_PCDF_2HIGEIA, Doacoes_Diligencia, CaixaEntrada_SEI
 * e Bens_Retirados nunca tiveram essa coluna — o valor era descartado em
 * silêncio a cada PATCH (inclusive ao adicionar observação). DATA_ATUALIZACAO
 * (outro campo, formato dd/mm/aaaa) sempre existiu e sempre atualizou certo,
 * só que não é o campo que a tela mostra.
 *
 *   node scripts/add-coluna-ultima-analise.mjs            # dry-run
 *   node scripts/add-coluna-ultima-analise.mjs --apply
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const APPLY = process.argv.includes('--apply');
const __dir = dirname(fileURLToPath(import.meta.url));
for (const l of readFileSync(resolve(__dir, '../.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

const ABAS = ['Bens_PCDF_2HIGEIA', 'Doacoes_Diligencia', 'CaixaEntrada_SEI', 'Bens_Retirados'];

const auth = new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();
console.log(APPLY ? '🚀 APLICAR\n' : '👁  DRY-RUN (use --apply)\n');

function paraIso(dataBr) {
  // "dd/mm/aaaa" -> ISO (meio-dia, pra não virar dia errado por fuso).
  // new Date("dd/mm/aaaa") é ambíguo (o parser assume mm/dd em pt-BR) — não usar.
  const m = String(dataBr || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(`${y}-${mo}-${d}T12:00:00`).toISOString();
}

for (const nome of ABAS) {
  const sheet = doc.sheetsByTitle[nome];
  if (!sheet) { console.log(`⚠️  ${nome}: não encontrada`); continue; }
  await sheet.loadHeaderRow();
  const h = [...sheet.headerValues];
  if (!h.includes('ULTIMA_ANALISE')) {
    const novo = [...h, 'ULTIMA_ANALISE'];
    console.log(`🔧 ${nome}: ${h.length} → ${novo.length} colunas (+ULTIMA_ANALISE)`);
    if (APPLY) {
      if (sheet.columnCount < novo.length) await sheet.resize({ rowCount: sheet.rowCount, columnCount: novo.length + 2 });
      await sheet.setHeaderRow(novo);
      console.log('   💾 ok');
    }
  } else {
    console.log(`✅ ${nome}: coluna já existe`);
  }

  // Backfill: ULTIMA_ANALISE vazio, mas DATA_ATUALIZACAO preenchido -> usa a
  // data de DATA_ATUALIZACAO (melhor um "última atualização" aproximado do
  // que ficar em branco, que ordenaria como se nunca tivesse sido mexido).
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  const candidatas = rows
    .map(r => ({ r, iso: paraIso(r.get('DATA_ATUALIZACAO')) }))
    .filter(x => x.iso && !(x.r.get('ULTIMA_ANALISE') || '').trim());
  console.log(`   backfill: ${candidatas.length} linha(s) sem ULTIMA_ANALISE mas com DATA_ATUALIZACAO`);
  if (APPLY && candidatas.length) {
    const cUlt = sheet.headerValues.indexOf('ULTIMA_ANALISE');
    const ultima = Math.max(...candidatas.map(x => x.r.rowNumber));
    await sheet.loadCells({ startRowIndex: 1, endRowIndex: ultima, startColumnIndex: cUlt, endColumnIndex: cUlt + 1 });
    for (const { r, iso } of candidatas) sheet.getCell(r.rowNumber - 1, cUlt).value = iso;
    await sheet.saveUpdatedCells();
    console.log(`   💾 ${candidatas.length} linha(s) preenchidas (1 requisição)`);
  }
}
console.log(APPLY ? '\n✅ Concluído.' : '\n👁  Nada gravado.');
