/**
 * scripts/add-colunas-fluxo-higeia.mjs
 *
 * Cria as colunas do fluxo de etapas HIGEIA (TEP → ofício DETRAN → resposta →
 * TAP → finalizado):
 *   - Bens_PCDF_1HIGEIA: STATUS_1HIGEIA, TEP_SEI, TEP_VALOR, DATA_TEP,
 *     DATA_OFICIO_DETRAN, DATA_RESPOSTA_DETRAN, DATA_TAP (replica o fluxo do 2º).
 *   - Bens_PCDF_2HIGEIA: DATA_OFICIO_DETRAN, DATA_RESPOSTA_DETRAN, DATA_TAP
 *     (colunas-fantasma — o botão do fluxo já mandava esses campos, mas
 *     não existia coluna, então eram descartados no save).
 *
 *   node scripts/add-colunas-fluxo-higeia.mjs            # dry-run
 *   node scripts/add-colunas-fluxo-higeia.mjs --apply
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
  Bens_PCDF_1HIGEIA: ['STATUS_1HIGEIA', 'TEP_SEI', 'TEP_VALOR', 'DATA_TEP', 'DATA_OFICIO_DETRAN', 'DATA_RESPOSTA_DETRAN', 'DATA_TAP'],
  Bens_PCDF_2HIGEIA: ['DATA_OFICIO_DETRAN', 'DATA_RESPOSTA_DETRAN', 'DATA_TAP'],
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
