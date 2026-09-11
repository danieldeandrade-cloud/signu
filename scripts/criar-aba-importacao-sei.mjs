/**
 * scripts/criar-aba-importacao-sei.mjs
 *
 * Cria a aba de staging "Importacao_SEI" — passo 2 da automação SEI
 * (automacao-sei/README.md): itens extraídos do SEI ficam aqui, pendentes de
 * revisão do gestor, antes de virar cadastro de verdade numa lista real.
 *
 *   node scripts/criar-aba-importacao-sei.mjs            # dry-run
 *   node scripts/criar-aba-importacao-sei.mjs --apply
 */
import { readFileSync } from 'fs';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const APPLY = process.argv.includes('--apply');
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

const NOME_ABA = 'Importacao_SEI';
const CABECALHO = [
  'PROCESSO_SEI', 'LISTA_DESTINO', 'CAMPOS_JSON', 'CONFIANCA', 'INFOSEG',
  'TEXTO_MARCADOR', 'CAMPOS_INCERTOS', 'ALERTAS', 'URL_SEI',
  'STATUS_REVISAO', 'DATA_IMPORTACAO', 'PROMOVIDO_EM', 'LISTA_ROW_PROMOVIDA',
];

const auth = new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();
console.log(APPLY ? '🚀 APLICAR\n' : '👁  DRY-RUN (use --apply)\n');

if (doc.sheetsByTitle[NOME_ABA]) {
  console.log(`✅ ${NOME_ABA}: já existe`);
} else {
  console.log(`🔧 ${NOME_ABA}: criar com colunas ${CABECALHO.join(', ')}`);
  if (APPLY) {
    await doc.addSheet({ title: NOME_ABA, headerValues: CABECALHO });
    console.log('   💾 ok');
  }
}
console.log(APPLY ? '\n✅ Concluído.' : '\n👁  Nada gravado.');
