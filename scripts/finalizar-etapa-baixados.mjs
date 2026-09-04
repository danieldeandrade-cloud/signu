/**
 * scripts/finalizar-etapa-baixados.mjs
 *
 * Itens com STATUS_DILIGENCIA = "BAIXADO" (já baixados / NIV íntegro / N-A —
 * ver scripts/higeia-baixado-e-remove-inutilizado.mjs) não passam pelo trâmite
 * de ofício ao DETRAN. Fecha a etapa HIGEIA (STATUS_1HIGEIA / STATUS_2HIGEIA)
 * direto em "FINALIZADO" para esses casos, em vez de deixar preso em
 * "TEP REGISTRADO" convidando a enviar ofício.
 *
 *   node scripts/finalizar-etapa-baixados.mjs            # dry-run
 *   node scripts/finalizar-etapa-baixados.mjs --apply
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const APPLY = process.argv.includes('--apply');
const __dir = dirname(fileURLToPath(import.meta.url));
for (const l of readFileSync(resolve(__dir, '../.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

const PLANO = {
  Bens_PCDF_1HIGEIA: 'STATUS_1HIGEIA',
  Bens_PCDF_2HIGEIA: 'STATUS_2HIGEIA',
};

const auth = new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();
console.log(APPLY ? '🚀 APLICAR\n' : '👁  DRY-RUN (use --apply)\n');

let total = 0;
for (const [nome, campoStatus] of Object.entries(PLANO)) {
  const s = doc.sheetsByTitle[nome];
  await s.loadHeaderRow();
  const cSt = s.headerValues.indexOf(campoStatus);
  const cOf = s.headerValues.indexOf('OFICIO_BAIXA');
  const rows = await s.getRows();
  const alvo = rows.filter(r =>
    String(r.get('STATUS_DILIGENCIA') || '').trim().toUpperCase() === 'BAIXADO' &&
    String(r.get(campoStatus) || '').trim().toUpperCase() !== 'FINALIZADO'
  );
  console.log(`${nome}: ${rows.length} linhas → ${alvo.length} BAIXADO com etapa ainda não finalizada`);
  total += alvo.length;
  if (APPLY && alvo.length) {
    const c0 = Math.min(cSt, cOf), c1 = Math.max(cSt, cOf) + 1;
    const ultima = Math.max(...alvo.map(r => r.rowNumber));
    await s.loadCells({ startRowIndex: 1, endRowIndex: ultima, startColumnIndex: c0, endColumnIndex: c1 });
    for (const r of alvo) {
      s.getCell(r.rowNumber - 1, cSt).value = 'FINALIZADO';
      s.getCell(r.rowNumber - 1, cOf).value = 'FALSE';
    }
    await s.saveUpdatedCells();
    console.log(`   💾 ${alvo.length} linhas atualizadas (1 requisição)`);
  }
}
console.log(APPLY ? `\n✅ Concluído. ${total} linhas finalizadas.` : `\n👁  ${total} linhas seriam finalizadas.`);
