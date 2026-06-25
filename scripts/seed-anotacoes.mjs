// scripts/seed-anotacoes.mjs
//
// Cria a aba "Anotacoes_Doacoes" na planilha SIGNU_DB e insere os registros
// históricos de doações não realizadas.
//
// Como executar (dentro da pasta signu):
//   node scripts/seed-anotacoes.mjs

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Carrega .env.local manualmente (sem dotenv)
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '..', '.env.local');
const envLines = readFileSync(envPath, 'utf-8').split('\n');
for (const line of envLines) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SHEET_NAME = 'Anotacoes_Doacoes';
const HEADERS    = ['DATA', 'ENTIDADE', 'MOTIVO', 'BEM_VINCULADO', 'OBSERVACOES'];

// ─── REGISTROS HISTÓRICOS ─────────────────────────────────────────────────────
const ANOTACOES = [
  {
    DATA:          '01/01/2024 00:00:00',
    ENTIDADE:      '1. Associação Casa de Proteção Magnólia - CPM',
    MOTIVO:        'Entidade suspensa ou fechada',
    BEM_VINCULADO: 'PA 0000741/2024 - ID 4774457',
    OBSERVACOES:   'Entidade transferiu o CNPJ a outra organização não credenciada junto ao TJDFT. Cadastro atualizado — CNPJ Atualizado — Entidade 1 (ID 4774403). Consultar PA 0000741/2024.',
  },
  {
    DATA:          '01/01/2024 00:01:00',
    ENTIDADE:      '5. Instituto de Desenvolvimento da Educação e Implementação de Ações Sociais - IDEIAS Ser Escola',
    MOTIVO:        'Recusou o bem oferecido',
    BEM_VINCULADO: 'PA 0024562/2023 - ID 4853527',
    OBSERVACOES:   'RECUSOU a doação. Penalidade aplicada: vai para o FIM DA FILA.',
  },
  {
    DATA:          '01/01/2024 00:02:00',
    ENTIDADE:      '11. Instituto Horizontes de Responsabilidade Social - IHRS',
    MOTIVO:        'Endereço desatualizado / não localizada',
    BEM_VINCULADO: '',
    OBSERVACOES:   'Entidade não foi encontrada. Deu-se sequência à posição 12ª. Sem penalidade.',
  },
  {
    DATA:          '01/01/2024 00:03:00',
    ENTIDADE:      '16. Movimento de Assistência aos Carentes da Metropolitana',
    MOTIVO:        'Recusou o bem oferecido',
    BEM_VINCULADO: 'PA 0024562/2023 - ID 4853527',
    OBSERVACOES:   'RECUSOU a doação. Penalidade aplicada: vai para o FIM DA FILA.',
  },
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

  let sheet = doc.sheetsByTitle[SHEET_NAME];

  if (!sheet) {
    console.log(`Criando aba "${SHEET_NAME}"…`);
    sheet = await doc.addSheet({ title: SHEET_NAME, headerValues: HEADERS });
    console.log(`✓ Aba criada com colunas: ${HEADERS.join(', ')}`);
  } else {
    console.log(`✓ Aba "${SHEET_NAME}" já existe.`);
    await sheet.setHeaderRow(HEADERS);
  }

  console.log(`\nInserindo ${ANOTACOES.length} registros históricos…`);
  for (const a of ANOTACOES) {
    await sheet.addRow(a);
    console.log(`  ✓ ${a.ENTIDADE}`);
  }

  console.log('\n✅ Concluído!');
}

main().catch(e => { console.error('\n❌ Erro:', e.message); process.exit(1); });
