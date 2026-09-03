/**
 * scripts/higeia-baixado-e-remove-inutilizado.mjs
 *
 * (1) BUG 3 — nas planilhas originais do 1º/2º HIGEIA, onde a coluna MOTIVO é
 *     "BAIXADO" ou "N/A", o veículo já foi baixado / não teve NIV aflorado:
 *       STATUS_DILIGENCIA = "BAIXADO"  e  OFICIO_BAIXA = "FALSE"
 *     (CEB_TEP_TIV fica intocado — pode ser registrado depois).
 * (2) BUG 4 — remove a coluna INUTILIZADO de Bens_PCDF_1HIGEIA e Bens_PCDF_2HIGEIA.
 *
 *   node scripts/higeia-baixado-e-remove-inutilizado.mjs            # dry-run
 *   node scripts/higeia-baixado-e-remove-inutilizado.mjs --apply
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const APPLY = process.argv.includes('--apply');
const __dir = dirname(fileURLToPath(import.meta.url));
for (const l of readFileSync(resolve(__dir, '../.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}
const canon = s => { const m = String(s || '').match(/(\d{2,7})\s*\/\s*(20\d{2})/); return m ? `${parseInt(m[1], 10)}/${m[2]}` : ''; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function retry(fn, label) {
  for (let i = 0; i < 8; i++) {
    try { return await fn(); }
    catch (e) {
      const code = e?.response?.status || e?.data?.error?.code;
      if (code === 429 || code === 503) { const w = 30000 + i * 15000; console.log(`   … ${label}: ${code}, aguardando ${Math.round(w / 1000)}s`); await sleep(w); continue; }
      throw e;
    }
  }
  throw new Error('retry esgotado: ' + label);
}

// ── MOTIVO do xlsm ─────────────────────────────────────────────────────────
const wb = xlsx.readFile(resolve(__dir, '../GESTÃO DE BENS NULEJ (4).xlsm'));
const baixado = new Set();
for (const [nome, motivoCol] of [['PCDF 1º HIGEIA', 6], ['PCDF 2º HIGEIA', 4]]) {
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: '' });
  for (const r of rows.slice(2)) {
    const pa = canon(r[0]);
    if (!pa) continue;
    const m = String(r[motivoCol] ?? '').trim().toUpperCase();
    if (m === 'BAIXADO' || m === 'N/A' || m === 'NA') baixado.add(pa);
  }
}
console.log(`MOTIVO "BAIXADO"/"N/A" no xlsm: ${baixado.size} processos\n`);

// ── Sistema ────────────────────────────────────────────────────────────────
const auth = new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();
console.log(APPLY ? '🚀 APLICAR\n' : '👁  DRY-RUN\n');

let totalUpd = 0;
for (const t of ['Bens_PCDF_1HIGEIA', 'Bens_PCDF_2HIGEIA']) {
  const s = doc.sheetsByTitle[t];
  await s.loadHeaderRow();
  const rows = await s.getRows();
  const alvo = rows.filter(r => baixado.has(canon(r.get('ID_PASEI'))) &&
    (String(r.get('STATUS_DILIGENCIA') || '').trim().toUpperCase() !== 'BAIXADO' || String(r.get('OFICIO_BAIXA') || '').toUpperCase() !== 'FALSE'));
  console.log(`${t}: ${rows.length} linhas → ${alvo.length} p/ marcar BAIXADO + OFICIO_BAIXA=FALSE`);
  totalUpd += alvo.length;
  if (APPLY && alvo.length) {
    const cSt = s.headerValues.indexOf('STATUS_DILIGENCIA');
    const cOf = s.headerValues.indexOf('OFICIO_BAIXA');
    const c0 = Math.min(cSt, cOf), c1 = Math.max(cSt, cOf) + 1;
    const ultima = Math.max(...alvo.map(r => r.rowNumber));
    await retry(() => s.loadCells({ startRowIndex: 1, endRowIndex: ultima, startColumnIndex: c0, endColumnIndex: c1 }), "loadCells " + t);
    for (const r of alvo) {
      s.getCell(r.rowNumber - 1, cSt).value = 'BAIXADO';
      s.getCell(r.rowNumber - 1, cOf).value = 'FALSE';
    }
    await retry(() => s.saveUpdatedCells(), "save " + t);
    console.log(`   💾 ${alvo.length} linhas atualizadas (1 requisição)`);
  }
}

// ── remove coluna INUTILIZADO ──────────────────────────────────────────────
console.log('\n── coluna INUTILIZADO ──');
const token = (await auth.getAccessToken()).token || (await auth.authorize()).access_token;
for (const t of ['Bens_PCDF_1HIGEIA', 'Bens_PCDF_2HIGEIA']) {
  const s = doc.sheetsByTitle[t];
  await s.loadHeaderRow();
  const idx = s.headerValues.indexOf('INUTILIZADO');
  if (idx < 0) { console.log(`${t}: já não tem INUTILIZADO`); continue; }
  console.log(`${t}: INUTILIZADO na coluna ${idx} (${String.fromCharCode(65 + idx)}) → remover`);
  if (APPLY) {
    const res = await retry(async () => {
      const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: s.sheetId, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 } } }] }),
      });
      if (r.status === 429 || r.status === 503) throw { response: { status: r.status } };
      return r;
    }, 'deleteCol ' + t);
    if (!res.ok) throw new Error(`${t}: batchUpdate ${res.status} ${await res.text()}`);
    console.log(`   💾 coluna removida`);
  }
}

console.log(APPLY ? `\n✅ CONCLUÍDO. ${totalUpd} linhas → BAIXADO.` : `\n👁  DRY-RUN. ${totalUpd} linhas seriam marcadas BAIXADO.`);
