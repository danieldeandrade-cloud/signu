// scripts/add-coluna-lote-doacoes.mjs
//
// Cria a coluna LOTE em Doacoes_Diligencia e preenche a partir da DPJ-GC99
// (mesmo PA). Os bens doados vêm de lotes da DPJ; o número do lote aparece na
// Gestão, no Detalhes e no Cadastro de doações (pedido do Daniel, 2026-10-14).
// Só preenche lote vazio e só quando o PA casa com UM lote na DPJ.
//
//   node scripts/add-coluna-lote-doacoes.mjs           # dry-run
//   node scripts/add-coluna-lote-doacoes.mjs --apply

import { readFileSync } from 'fs';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}
const APPLY = process.argv.includes('--apply');
const auth = new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();

const sheet = doc.sheetsByTitle['Doacoes_Diligencia'];
await sheet.loadHeaderRow();
if (!sheet.headerValues.includes('LOTE')) {
  if (APPLY) {
    const headers = [...sheet.headerValues, 'LOTE'];
    if (headers.length > sheet.columnCount) await sheet.resize({ rowCount: sheet.rowCount, columnCount: headers.length });
    await sheet.setHeaderRow(headers);
    console.log('coluna LOTE criada');
  } else console.log('(dry-run) criaria a coluna LOTE');
}

const norm = (v) => String(v || '').replace(/\D/g, '');
const dpj = await doc.sheetsByTitle['Bens_DPJ_GC99'].getRows();
const rows = await sheet.getRows();
let n = 0;
for (const r of rows) {
  if (String(r.get('LOTE') || '').trim()) continue;
  const pa = norm(r.get('ID_PASEI'));
  const lotes = [...new Set(dpj.filter((d) => pa && norm(d.get('PA') || d.get('PA_PJE')) === pa).map((d) => String(d.get('LOTE') || '').trim()).filter(Boolean))];
  if (lotes.length !== 1) { console.log(`linha ${r.rowNumber} ${r.get('ID_PASEI')}: ${lotes.length} lote(s) na DPJ — pulando`); continue; }
  console.log(`linha ${r.rowNumber} ${r.get('ID_PASEI')} → lote ${lotes[0]}`);
  if (APPLY) { r.set('LOTE', lotes[0]); await r.save(); }
  n++;
}
console.log(APPLY ? `✅ ${n} preenchidos` : `👁  ${n} seriam preenchidos`);
