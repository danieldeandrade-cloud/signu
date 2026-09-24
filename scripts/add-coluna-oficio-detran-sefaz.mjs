// scripts/add-coluna-oficio-detran-sefaz.mjs
// Adiciona a coluna OFICIO_DETRAN_SEFAZ em Bens_CEGOC — flag única (ofício
// enviado pros dois órgãos junto) pra itens em status CATÁLOGO, pra servidor
// saber o que ainda precisa do ofício antes do leilão.
import { readFileSync } from 'fs';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();

const sheet = doc.sheetsByTitle['Bens_CEGOC'];
await sheet.loadHeaderRow();
if (sheet.headerValues.includes('OFICIO_DETRAN_SEFAZ')) {
  console.log('Bens_CEGOC -> já tem OFICIO_DETRAN_SEFAZ');
} else {
  const headers = [...sheet.headerValues, 'OFICIO_DETRAN_SEFAZ'];
  if (headers.length > sheet.columnCount) {
    await sheet.resize({ rowCount: sheet.rowCount, columnCount: headers.length });
    console.log('Bens_CEGOC -> grid redimensionado pra', headers.length, 'colunas');
  }
  await sheet.setHeaderRow(headers);
  console.log('Bens_CEGOC -> coluna OFICIO_DETRAN_SEFAZ adicionada');
}
