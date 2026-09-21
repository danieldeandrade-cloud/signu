// scripts/backfill-visto-em.mjs
// Backfill único: marca VISTO_EM em todos os itens JÁ EXISTENTES (só os que
// ainda estão vazios) como "já visto agora" — sem isso, a fila inteira
// aparecia com o selo "NOVO" simplesmente porque a coluna é nova e nunca
// tinha sido preenchida. Daqui pra frente, "novo" só vale pra mudança real
// (atribuição/edição por outra pessoa) feita depois deste backfill.
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
const agora = new Date().toISOString();
const APLICAR = process.argv.includes('--apply');

for (const nome of ABAS) {
  const sheet = doc.sheetsByTitle[nome];
  if (!sheet) { console.log(nome, '-> aba não encontrada, pulando'); continue; }
  await sheet.loadCells();
  const headers = {};
  for (let c = 0; c < sheet.columnCount; c++) {
    const h = sheet.getCell(0, c).value;
    if (h) headers[h] = c;
  }
  if (headers.VISTO_EM === undefined) { console.log(nome, '-> sem coluna VISTO_EM, pulando'); continue; }

  let marcados = 0;
  for (let r = 1; r < sheet.rowCount; r++) {
    // linha vazia (sem nenhum dado na 1ª coluna) = fim da planilha, ignora
    const primeiraCol = sheet.getCell(r, 0).value;
    if (!primeiraCol) continue;
    const cell = sheet.getCell(r, headers.VISTO_EM);
    if (!cell.value) {
      if (APLICAR) cell.value = agora;
      marcados++;
    }
  }
  if (APLICAR) await sheet.saveUpdatedCells();
  console.log(nome, '->', marcados, APLICAR ? 'marcados como já visto' : '(dry-run, use --apply pra gravar)');
}
