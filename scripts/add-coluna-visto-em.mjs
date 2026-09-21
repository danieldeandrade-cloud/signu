// scripts/add-coluna-visto-em.mjs
// Adiciona a coluna VISTO_EM (visto/não visto por servidor) nas listas que
// aparecem na Minha Fila. Vazio = "novo" (nunca visto pelo responsável atual
// desde a última atribuição/mudança feita por outra pessoa).
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

const ABAS = ['Bens_CEGOC', 'Bens_PCDF_1HIGEIA', 'Bens_PCDF_2HIGEIA', 'Bens_DPJ_GC99', 'CaixaEntrada_SEI'];

for (const nome of ABAS) {
  const sheet = doc.sheetsByTitle[nome];
  if (!sheet) { console.log(nome, '-> aba não encontrada, pulando'); continue; }
  await sheet.loadHeaderRow();
  if (sheet.headerValues.includes('VISTO_EM')) {
    console.log(nome, '-> já tem VISTO_EM');
    continue;
  }
  const headers = [...sheet.headerValues, 'VISTO_EM'];
  if (headers.length > sheet.columnCount) {
    await sheet.resize({ rowCount: sheet.rowCount, columnCount: headers.length });
    console.log(nome, '-> grid redimensionado pra', headers.length, 'colunas');
  }
  await sheet.setHeaderRow(headers);
  console.log(nome, '-> coluna VISTO_EM adicionada');
}
