/**
 * scripts/migrar-nomes.mjs
 *
 * Migra os apelidos do campo RESPONSAVEL para os nomes completos usados no sistema.
 * Roda localmente com: node scripts/migrar-nomes.mjs
 * Passe --apply para gravar as alterações; sem a flag, só mostra o que seria alterado.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// ── Carrega .env.local manualmente ──────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

// ── Mapeamento apelido → nome completo ──────────────────────────────────────
const NOMES = {
  'AMANDA':    'Amanda Junqueira',
  'CARLINHOS': 'Carlos Caetano',
  'LETÍCIA':   'Letícia Mota',
  'LETICIA':   'Letícia Mota',
  'LOARA':     'Loara Passo',
  'CARLA':     'Carla Araújo',
  'MARCELO':   'Marcelo Oliveira',
  'CLÁUDIA':   'Cláudia Santos',
  'CLAUDIA':   'Cláudia Santos',
};

// ── Abas que têm campo RESPONSAVEL ──────────────────────────────────────────
const ABAS = [
  'Entidades_Credenciadas',
  'Bens_CEGOC',
  'Bens_DPJ_GC99',
  'Bens_PCDF_1HIGEIA',
  'Bens_PCDF_2HIGEIA',
  'CaixaEntrada_SEI',
  'Doacoes_Diligencia',
  'Doacoes_Realizadas',
  'Bens_Retirados',
  'Anotacoes_Doacoes',
];

const APPLY = process.argv.includes('--apply');

async function main() {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key:   process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
  await doc.loadInfo();
  console.log(`\n📋 Planilha: ${doc.title}`);
  console.log(APPLY ? '🚀 MODO: APLICAR alterações\n' : '👁  MODO: DRY-RUN (passe --apply para gravar)\n');

  let totalAlterado = 0;

  for (const nomAba of ABAS) {
    const sheet = doc.sheetsByTitle[nomAba];
    if (!sheet) { console.log(`⚠️  Aba "${nomAba}" não encontrada — pulando`); continue; }

    await sheet.loadHeaderRow();
    const colIdx = sheet.headerValues.indexOf('RESPONSAVEL');
    if (colIdx === -1) { console.log(`✅ ${nomAba}: sem coluna RESPONSAVEL`); continue; }

    // Carrega todas as células da aba de uma vez (1 req de leitura)
    await sheet.loadCells();
    const nLinhas = sheet.rowCount;
    const alteracoes = [];

    for (let r = 1; r < nLinhas; r++) { // linha 0 = cabeçalho
      const cell = sheet.getCell(r, colIdx);
      const atual = (cell.value || '').toString().trim().toUpperCase();
      const novoNome = NOMES[atual];
      if (novoNome) {
        alteracoes.push({ linha: r + 1, de: cell.value, para: novoNome, cell });
      }
    }

    if (alteracoes.length === 0) {
      console.log(`✅ ${nomAba}: nenhum apelido encontrado`);
      continue;
    }

    console.log(`🔄 ${nomAba}: ${alteracoes.length} linha(s) a corrigir`);
    for (const { linha, de, para, cell } of alteracoes) {
      console.log(`   #${linha}  "${de}" → "${para}"`);
      if (APPLY) cell.value = para;
    }

    if (APPLY) {
      // Salva todas as células alteradas em UMA única requisição por aba
      await sheet.saveUpdatedCells();
      console.log(`   💾 Salvo.`);
    }

    totalAlterado += alteracoes.length;
  }

  console.log(`\n${'─'.repeat(50)}`);
  if (APPLY) {
    console.log(`✅ Migração concluída — ${totalAlterado} linha(s) atualizadas na planilha.`);
  } else {
    console.log(`👁  Dry-run: ${totalAlterado} linha(s) seriam atualizadas.`);
    console.log(`   Para aplicar: node scripts/migrar-nomes.mjs --apply`);
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
