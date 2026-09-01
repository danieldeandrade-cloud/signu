/**
 * scripts/fix-destinacao-higeia.mjs
 *
 * Garante DESTINACAO = "RECICLAGEM" em TODOS os itens de Bens_PCDF_1HIGEIA e
 * Bens_PCDF_2HIGEIA (itens em HIGEIA vão sempre para reciclagem). Cria a
 * coluna DESTINACAO se não existir.
 *
 *   node scripts/fix-destinacao-higeia.mjs            # dry-run
 *   node scripts/fix-destinacao-higeia.mjs --apply
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const APPLY = process.argv.includes('--apply');
const __dir = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(__dir, '../.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

const ABAS = ['Bens_PCDF_1HIGEIA', 'Bens_PCDF_2HIGEIA'];
const VALOR = 'RECICLAGEM';

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();

console.log(APPLY ? '🚀 APLICAR\n' : '👁  DRY-RUN (use --apply)\n');
for (const nome of ABAS) {
  const sheet = doc.sheetsByTitle[nome];
  if (!sheet) { console.log(`⚠️  ${nome}: não encontrada`); continue; }

  await sheet.loadHeaderRow();
  let headers = [...sheet.headerValues];
  const tinhaColuna = headers.includes('DESTINACAO');
  if (!tinhaColuna) {
    headers = [...headers, 'DESTINACAO'];
    console.log(`🔧 ${nome}: criando coluna DESTINACAO (${sheet.headerValues.length} → ${headers.length})`);
    if (APPLY) {
      if (sheet.columnCount < headers.length) {
        await sheet.resize({ rowCount: sheet.rowCount, columnCount: headers.length + 2 });
      }
      await sheet.setHeaderRow(headers);
    }
  }

  const rows = await sheet.getRows();
  const colIdx = headers.indexOf('DESTINACAO');
  const aCorrigir = rows.filter(r => String(r.get('DESTINACAO') || '').trim().toUpperCase() !== VALOR);
  console.log(`   ${nome}: ${rows.length} linhas · ${aCorrigir.length} a ajustar para ${VALOR}`);

  if (APPLY && aCorrigir.length) {
    const ultima = rows[rows.length - 1].rowNumber; // 1-based
    await sheet.loadCells({
      startRowIndex: 1, endRowIndex: ultima,
      startColumnIndex: colIdx, endColumnIndex: colIdx + 1,
    });
    for (const r of aCorrigir) {
      sheet.getCell(r.rowNumber - 1, colIdx).value = VALOR; // getCell é 0-based
    }
    await sheet.saveUpdatedCells();
    console.log(`   💾 ${aCorrigir.length} células atualizadas (1 requisição).`);
  }
}
console.log(APPLY ? '\n✅ Concluído.' : '\n👁  Nada gravado.');
