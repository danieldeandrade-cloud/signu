/**
 * scripts/peso-estimado.mjs
 *
 * 1) Cria a coluna PESO_KG em Bens_CEGOC e Bens_DPJ_GC99 (não existia).
 * 2) Completa PESO_KG vazio em Bens_PCDF_1HIGEIA / Bens_PCDF_2HIGEIA com a
 *    mediana por TIPO_BEM calculada dos valores já preenchidos (peso estimado).
 *
 *   node scripts/peso-estimado.mjs            # dry-run
 *   node scripts/peso-estimado.mjs --apply
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const APPLY = process.argv.includes('--apply');
const __dir = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(__dir, '../.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? null : n;
};
const mediana = (arr) => {
  const a = [...arr].sort((x, y) => x - y);
  const n = a.length;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
};

console.log(APPLY ? '🚀 APLICAR\n' : '👁  DRY-RUN (use --apply)\n');

// ── 1) coluna PESO_KG em CEGOC e DPJ ──────────────────────────────────────────
for (const nome of ['Bens_CEGOC', 'Bens_DPJ_GC99']) {
  const sheet = doc.sheetsByTitle[nome];
  await sheet.loadHeaderRow();
  const h = [...sheet.headerValues];
  if (h.includes('PESO_KG')) { console.log(`✅ ${nome}: já tem PESO_KG`); continue; }
  console.log(`🔧 ${nome}: +coluna PESO_KG (${h.length} → ${h.length + 1})`);
  if (APPLY) {
    const novo = [...h, 'PESO_KG'];
    if (sheet.columnCount < novo.length) await sheet.resize({ rowCount: sheet.rowCount, columnCount: novo.length + 2 });
    await sheet.setHeaderRow(novo);
  }
}

// ── 2) mediana por TIPO_BEM a partir dos pesos já preenchidos ─────────────────
const abasHigeia = ['Bens_PCDF_1HIGEIA', 'Bens_PCDF_2HIGEIA'];
const porTipo = {};
const linhasPorAba = {};
for (const nome of abasHigeia) {
  const sheet = doc.sheetsByTitle[nome];
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  linhasPorAba[nome] = { sheet, rows };
  for (const r of rows) {
    const tipo = String(r.get('TIPO_BEM') || 'OUTROS').trim().toUpperCase() || 'OUTROS';
    const v = num(r.get('PESO_KG'));
    if (v && v > 0) (porTipo[tipo] = porTipo[tipo] || []).push(v);
  }
}
const medianaTipo = {};
for (const [t, vs] of Object.entries(porTipo)) medianaTipo[t] = mediana(vs);
const fallbackGlobal = mediana(Object.values(porTipo).flat());
console.log('\n📊 mediana por tipo:', JSON.stringify(medianaTipo), `(fallback ${fallbackGlobal})`);

// ── 3) completa os vazios ────────────────────────────────────────────────────
let totalPreenchidos = 0;
for (const nome of abasHigeia) {
  const { sheet, rows } = linhasPorAba[nome];
  const colIdx = sheet.headerValues.indexOf('PESO_KG');
  const alvos = rows.filter((r) => !String(r.get('PESO_KG') || '').trim());
  const porTipoCount = {};
  alvos.forEach((r) => {
    const t = String(r.get('TIPO_BEM') || 'OUTROS').trim().toUpperCase() || 'OUTROS';
    porTipoCount[t] = (porTipoCount[t] || 0) + 1;
  });
  console.log(`\n🔧 ${nome}: ${alvos.length} linhas sem peso → ${JSON.stringify(porTipoCount)}`);
  totalPreenchidos += alvos.length;

  if (APPLY && alvos.length) {
    const ultima = rows[rows.length - 1].rowNumber;
    await sheet.loadCells({ startRowIndex: 1, endRowIndex: ultima, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 });
    for (const r of alvos) {
      const t = String(r.get('TIPO_BEM') || 'OUTROS').trim().toUpperCase() || 'OUTROS';
      const est = medianaTipo[t] ?? fallbackGlobal;
      sheet.getCell(r.rowNumber - 1, colIdx).value = est;
    }
    await sheet.saveUpdatedCells();
    console.log(`   💾 ${alvos.length} pesos estimados gravados`);
  }
}

console.log(APPLY
  ? `\n✅ Concluído. ${totalPreenchidos} pesos estimados adicionados na HIGEIA.`
  : `\n👁  Nada gravado. ${totalPreenchidos} linhas seriam estimadas.`);
