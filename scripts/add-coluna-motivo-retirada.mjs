// scripts/add-coluna-motivo-retirada.mjs
// Adiciona a coluna MOTIVO_RETIRADA em Bens_PCDF_1HIGEIA e Bens_PCDF_2HIGEIA —
// preenchida via modal quando o status vira RETIRADO (bem sai do controle
// ativo do NULEJ: restituído, etc — ver app/detalhes/page.jsx).
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

const ABAS = ['Bens_PCDF_1HIGEIA', 'Bens_PCDF_2HIGEIA'];

for (const nome of ABAS) {
  const sheet = doc.sheetsByTitle[nome];
  if (!sheet) { console.log(nome, '-> aba não encontrada, pulando'); continue; }
  await sheet.loadHeaderRow();
  if (sheet.headerValues.includes('MOTIVO_RETIRADA')) {
    console.log(nome, '-> já tem MOTIVO_RETIRADA');
    continue;
  }
  const headers = [...sheet.headerValues, 'MOTIVO_RETIRADA'];
  if (headers.length > sheet.columnCount) {
    await sheet.resize({ rowCount: sheet.rowCount, columnCount: headers.length });
    console.log(nome, '-> grid redimensionado pra', headers.length, 'colunas');
  }
  await sheet.setHeaderRow(headers);
  console.log(nome, '-> coluna MOTIVO_RETIRADA adicionada');
}
