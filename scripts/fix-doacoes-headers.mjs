// scripts/fix-doacoes-headers.mjs
//
// Garante que a aba Doacoes_Diligencia tenha todos os cabeçalhos necessários,
// incluindo ENTIDADE. Colunas existentes não são removidas.
//
// Como executar (dentro da pasta signu):
//   node scripts/fix-doacoes-headers.mjs

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '..', '.env.local');
const envLines = readFileSync(envPath, 'utf-8').split('\n');
for (const line of envLines) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Cabeçalhos completos que a aba deve ter (ordem importa para novas colunas)
const CABECALHOS_COMPLETOS = [
  'ID_LEGADO',
  'ID_PASEI',
  'TIPO_BEM',
  'NIV',
  'DESCRICAO',
  'ENTIDADE',
  'STATUS_LOCAL_PA',
  'DATA_CADASTRO',
  'RESPONSAVEL',
  'OBSERVACOES',
  'FIB',
  'CEB_TEP_TIV',
];

async function main() {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key:   process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
  await doc.loadInfo();
  console.log(`✓ Planilha: ${doc.title}`);

  const sheet = doc.sheetsByTitle['Doacoes_Diligencia'];
  if (!sheet) {
    console.error('❌ Aba "Doacoes_Diligencia" não encontrada.');
    process.exit(1);
  }

  // Carrega os cabeçalhos atuais
  await sheet.loadHeaderRow();
  const headersAtuais = sheet.headerValues || [];
  console.log(`\nCabeçalhos atuais: ${headersAtuais.join(', ') || '(nenhum)'}`);

  // Identifica colunas que faltam
  const faltando = CABECALHOS_COMPLETOS.filter(h => !headersAtuais.includes(h));

  if (faltando.length === 0) {
    console.log('\n✅ Todos os cabeçalhos já existem. Nenhuma alteração necessária.');
    return;
  }

  console.log(`\nColunas faltando: ${faltando.join(', ')}`);

  // Novo conjunto de cabeçalhos: existentes + faltando (sem duplicar)
  const novosHeaders = [...headersAtuais, ...faltando];
  await sheet.setHeaderRow(novosHeaders);

  console.log(`\n✅ Cabeçalhos atualizados: ${novosHeaders.join(', ')}`);
  console.log('\nAtenção: os registros existentes não têm ENTIDADE preenchida.');
  console.log('Preencha manualmente na planilha ou via novo cadastro.');
}

main().catch(e => { console.error('\n❌ Erro:', e.message); process.exit(1); });
