/**
 * scripts/add-colunas-pa-pje-dpj.mjs
 *
 * Separa PA_PJE (campo único e ambíguo) em dois campos na DPJ:
 *   - PA  = número do processo SEI
 *   - PJE = número do processo judicial (PJe, formato CNJ) vinculado ao lote
 *
 * Backfill: classifica o valor atual de PA_PJE pelo FORMATO — CNJ
 * (nnnnnnn-nn.nnnn.n.nn.nnnn) vai pra PJE, qualquer outro formato (o número
 * do SEI, ex. 0037595/2026) vai pra PA. Reduz o backfill errado — antes
 * assumia sempre PJE e um teste real mostrou PA_PJE com número do SEI.
 * A coluna PA_PJE é mantida (vestigial), não é apagada.
 *
 *   node scripts/add-colunas-pa-pje-dpj.mjs            # dry-run
 *   node scripts/add-colunas-pa-pje-dpj.mjs --apply
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

const auth = new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();
console.log(APPLY ? '🚀 APLICAR\n' : '👁  DRY-RUN (use --apply)\n');

const sheet = doc.sheetsByTitle['Bens_DPJ_GC99'];
await sheet.loadHeaderRow();
const h = [...sheet.headerValues];
const faltando = ['PA', 'PJE'].filter(c => !h.includes(c));
if (faltando.length) {
  const novo = [...h, ...faltando];
  console.log(`🔧 Bens_DPJ_GC99: ${h.length} → ${novo.length} colunas (+${faltando.join(', +')})`);
  if (APPLY) {
    if (sheet.columnCount < novo.length) await sheet.resize({ rowCount: sheet.rowCount, columnCount: novo.length + 2 });
    await sheet.setHeaderRow(novo);
    console.log('   💾 ok');
  }
} else {
  console.log('✅ Bens_DPJ_GC99: colunas PA/PJE já existem');
}

// Backfill: classifica PA_PJE pelo formato (CNJ = PJE; outro = PA).
// loadCells/saveUpdatedCells (1 requisição) — NUNCA row.save() em loop, estoura
// o limite de 60 escritas/min do Sheets (já bati nisso rodando este script).
const RE_CNJ = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
await sheet.loadHeaderRow();
const rows = await sheet.getRows();
const candidatas = rows.filter(r => (r.get('PA_PJE') || '').trim() && !(r.get('PA') || '').trim() && !(r.get('PJE') || '').trim());
const paCandidatas = candidatas.filter(r => !RE_CNJ.test((r.get('PA_PJE') || '').trim()));
const pjeCandidatas = candidatas.filter(r => RE_CNJ.test((r.get('PA_PJE') || '').trim()));
console.log(`\n🔧 Backfill por formato: ${candidatas.length} linha(s) — ${paCandidatas.length} viram PA (não-CNJ), ${pjeCandidatas.length} viram PJE (formato CNJ)`);
if (APPLY && candidatas.length) {
  const cPaPje = sheet.headerValues.indexOf('PA_PJE');
  const cPa = sheet.headerValues.indexOf('PA');
  const cPje = sheet.headerValues.indexOf('PJE');
  const c0 = Math.min(cPaPje, cPa, cPje), c1 = Math.max(cPaPje, cPa, cPje) + 1;
  const ultima = Math.max(...candidatas.map(r => r.rowNumber));
  await sheet.loadCells({ startRowIndex: 1, endRowIndex: ultima, startColumnIndex: c0, endColumnIndex: c1 });
  for (const r of paCandidatas) sheet.getCell(r.rowNumber - 1, cPa).value = r.get('PA_PJE');
  for (const r of pjeCandidatas) sheet.getCell(r.rowNumber - 1, cPje).value = r.get('PA_PJE');
  await sheet.saveUpdatedCells();
  console.log(`   💾 ${candidatas.length} linhas atualizadas (1 requisição)`);
}

console.log(APPLY ? '\n✅ Concluído.' : '\n👁  Nada gravado.');
