// scripts/formatar-colunas-data.mjs
//
// A SIGNU_DB está em locale en_US: célula de data sem formato próprio volta
// como "10/16/2026" (mês/dia) e o SIGNU lê dd/mm — data errada. Este script
// fixa o formato aaaa-mm-dd nas colunas de data (DATA_*, PRAZO_6MESES) das
// listas, inclusive nas linhas em branco (onde os cadastros novos são
// gravados), e garante folga de linhas já formatadas. Idempotente.
// Só muda a EXIBIÇÃO; valores e células de texto ficam como estão.
//
//   node scripts/formatar-colunas-data.mjs

import { readFileSync } from 'fs';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}
const auth = new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();

const ABAS = ['Bens_CEGOC', 'Bens_PCDF_1HIGEIA', 'Bens_PCDF_2HIGEIA', 'Bens_DPJ_GC99', 'CaixaEntrada_SEI', 'Doacoes_Diligencia'];
const FOLGA = 500;

for (const t of ABAS) {
  const sh = doc.sheetsByTitle[t];
  await sh.loadHeaderRow();
  const rows = await sh.getRows();
  if (sh.rowCount - rows.length - 1 < FOLGA) {
    await sh.resize({ rowCount: rows.length + 1 + FOLGA, columnCount: sh.columnCount });
  }
  const cols = sh.headerValues.map((h, i) => [h, i]).filter(([h]) => /^DATA_|^PRAZO_6MESES$/.test(h));
  await doc._makeBatchUpdateRequest(cols.map(([, c]) => ({
    repeatCell: {
      range: { sheetId: sh.sheetId, startRowIndex: 1, endRowIndex: sh.rowCount, startColumnIndex: c, endColumnIndex: c + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' } } },
      fields: 'userEnteredFormat.numberFormat',
    },
  })));
  console.log(`${t}: ${cols.map(([h]) => h).join(', ')} | ${sh.rowCount} linhas de grade`);
}
