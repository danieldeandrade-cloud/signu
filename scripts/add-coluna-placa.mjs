/**
 * scripts/add-coluna-placa.mjs
 *
 * Adiciona a coluna PLACA (no fim do cabeçalho) nas abas de bens que têm
 * o campo PLACA no formulário de cadastro. Sem isso o valor digitado é
 * descartado ao salvar (o addRow do google-spreadsheet ignora chaves sem coluna).
 *
 *   node scripts/add-coluna-placa.mjs            # dry-run
 *   node scripts/add-coluna-placa.mjs --apply
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

const ABAS = ['Bens_CEGOC', 'Bens_DPJ_GC99', 'Bens_PCDF_1HIGEIA', 'Bens_PCDF_2HIGEIA', 'Doacoes_Diligencia'];
const COLUNA = 'PLACA';

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
  const h = [...sheet.headerValues];
  if (h.includes(COLUNA)) { console.log(`✅ ${nome}: já tem ${COLUNA}`); continue; }
  const novo = [...h, COLUNA];
  console.log(`🔧 ${nome}: ${h.length} → ${novo.length} colunas  (+${COLUNA})`);
  if (APPLY) {
    if (sheet.columnCount < novo.length) {
      await sheet.resize({ rowCount: sheet.rowCount, columnCount: novo.length + 2 });
    }
    await sheet.setHeaderRow(novo);
    console.log(`   💾 ok`);
  }
}
console.log(APPLY ? '\n✅ Concluído.' : '\n👁  Nada gravado.');
