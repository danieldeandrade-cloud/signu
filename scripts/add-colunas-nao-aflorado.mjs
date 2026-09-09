/**
 * scripts/add-colunas-nao-aflorado.mjs
 *
 * Cria as colunas do "veículo não aflorado" nas duas listas HIGEIA:
 *   - NIV_NAO_AFLORADO  (TRUE/FALSE) — NIV nunca localizado; força BAIXADO
 *     e finaliza a etapa HIGEIA.
 *   - PLACA_OSTENTADA   (texto)      — placa que o veículo ostentava, usada
 *     só para busca no sistema (evitar cadastro duplicado).
 *
 *   node scripts/add-colunas-nao-aflorado.mjs            # dry-run
 *   node scripts/add-colunas-nao-aflorado.mjs --apply
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

const PLANO = {
  Bens_PCDF_1HIGEIA: ['NIV_NAO_AFLORADO', 'PLACA_OSTENTADA'],
  Bens_PCDF_2HIGEIA: ['NIV_NAO_AFLORADO', 'PLACA_OSTENTADA'],
};

const auth = new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();
console.log(APPLY ? '🚀 APLICAR\n' : '👁  DRY-RUN (use --apply)\n');

for (const [nome, colunas] of Object.entries(PLANO)) {
  const sheet = doc.sheetsByTitle[nome];
  if (!sheet) { console.log(`⚠️  ${nome}: não encontrada`); continue; }
  await sheet.loadHeaderRow();
  const h = [...sheet.headerValues];
  const faltando = colunas.filter(c => !h.includes(c));
  if (faltando.length === 0) { console.log(`✅ ${nome}: já tem todas`); continue; }
  const novo = [...h, ...faltando];
  console.log(`🔧 ${nome}: ${h.length} → ${novo.length} colunas  (+${faltando.join(', +')})`);
  if (APPLY) {
    if (sheet.columnCount < novo.length) await sheet.resize({ rowCount: sheet.rowCount, columnCount: novo.length + 2 });
    await sheet.setHeaderRow(novo);
    console.log('   💾 ok');
  }
}
console.log(APPLY ? '\n✅ Concluído.' : '\n👁  Nada gravado.');
