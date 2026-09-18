// scripts/criar-aba-historico.mjs
// Cria a aba Historico_Alteracoes — log de auditoria: quem editou o quê,
// quando, e o que mudou. Base para relatórios de produtividade por servidor.
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

const NOME = 'Historico_Alteracoes';
if (doc.sheetsByTitle[NOME]) {
  console.log(`Aba "${NOME}" já existe, nada a fazer.`);
  process.exit(0);
}

const sheet = await doc.addSheet({
  title: NOME,
  headerValues: [
    'TIMESTAMP',   // ISO
    'LISTA',       // cegoc, dpj, pcdf1, pcdf2, doacoes_diligencia, sei...
    'ROW_NUMBER',  // linha na aba de destino
    'ITEM_ID',     // ID_PASEI/PA/PJE do item, quando disponível
    'ACAO',        // CRIADO | EDITADO | TRANSICAO | PROMOVIDO | TEP_REGISTRADO | CONCLUIDO_SEI
    'AUTOR',       // nome do servidor/gestor logado
    'CAMPOS_ALTERADOS', // JSON {campo: {de, para}}
  ],
});
console.log(`Aba "${NOME}" criada (sheetId ${sheet.sheetId}).`);
