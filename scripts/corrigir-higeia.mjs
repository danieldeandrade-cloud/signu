/**
 * scripts/corrigir-higeia.mjs
 *
 * Correção do 1º/2º HIGEIA a partir da relação oficial da PCDF (TJDFT.xlsx).
 *   Fase 1 (A1) — move do 2º p/ o 1º os itens que a PCDF tem no 1º e o
 *                 sistema tem no 2º (sem cópia no 1º). Campos exclusivos do
 *                 2º (PA_TJDFT, STATUS_2HIGEIA, TEP_*, ORIGEM_CEGOC_ID) são
 *                 dobrados no início de OBSERVACOES.
 *   Fase 2 (dedup) — para cada grupo de linhas duplicadas (mesmo NIV ou
 *                 mesmo processo) em 1º/2º, mantém a MAIS COMPLETA, copia
 *                 para ela os campos vazios das outras e apaga as demais.
 *   Fase 3 (varredura D) — só leitura: procura em TODAS as abas os itens
 *                 da relação da PCDF ausentes do HIGEIA e gera um CSV.
 *
 *   node scripts/corrigir-higeia.mjs            # dry-run (não grava)
 *   node scripts/corrigir-higeia.mjs --apply
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const APPLY = process.argv.includes('--apply');
const __dir = dirname(fileURLToPath(import.meta.url));
for (const l of readFileSync(resolve(__dir, '../.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}
const PCDF_JSON = '/private/tmp/claude-501/-Users-danielcarneiromendesdeandrade-signu/2c5e73ce-1790-4d41-b72c-ecc733721107/scratchpad/tjdft_pcdf.json';
const OUTDIR = resolve(__dir, '../SIGNU_CSVs/analise_TJDFT');
mkdirSync(OUTDIR, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const isVin = s => { const n = norm(s); return n.length >= 16 && n.length <= 18 && /[0-9]/.test(n) && /[A-Z]/.test(n); };
const isPlaca = s => /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/.test(norm(s));
const canonPasei = s => { const m = String(s || '').match(/(\d{2,})\s*\/\s*(\d{4})/); return m ? `${parseInt(m[1], 10)}/${m[2]}` : ''; };
const DESC = new Set(['DESCONHECIDO', 'DESCONHECIDA', 'NAOHA', 'NA', 'X', 'SUPRIMIDO', 'SEMPLACA', 'SEMPLACAS', 'SEMNIV', 'XXX', '']);
const clean = s => { const v = norm(s); return DESC.has(v) ? '' : String(s || '').trim(); };

async function retry(fn, label) {
  for (let i = 0; i < 6; i++) {
    try { return await fn(); }
    catch (e) {
      const code = e?.response?.status;
      if (code === 429 || code === 503) { const w = 2000 * (i + 1); console.log(`   … ${label}: ${code}, aguardando ${w}ms`); await sleep(w); continue; }
      throw e;
    }
  }
  throw new Error('retry esgotado: ' + label);
}

const auth = new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();
console.log(APPLY ? '🚀 APLICAR\n' : '👁  DRY-RUN — nada será gravado (use --apply)\n');

// ── PCDF ─────────────────────────────────────────────────────────────────────
const pcdf = JSON.parse(readFileSync(PCDF_JSON));
const pIdx = { niv: {}, placa: {}, pas: {} };
pcdf.forEach((r, i) => {
  r._i = i;
  const nivs = [r.NIV_OSTENTADO, r.NIV_ORIGINAL].map(clean).filter(isVin).map(norm);
  const placas = [r.PLACA_OSTENTADA, r.PLACA_ORIGINAL].map(clean).filter(isPlaca).map(norm);
  const pas = canonPasei(r.PROCESSO_SEI);
  r._k = { nivs, placas, pas };
  nivs.forEach(n => (pIdx.niv[n] = pIdx.niv[n] || []).push(r));
  placas.forEach(p => (pIdx.placa[p] = pIdx.placa[p] || []).push(r));
  if (pas) (pIdx.pas[pas] = pIdx.pas[pas] || []).push(r);
});
const pcdfMatch = (niv, placaCol, pasei) => {
  const set = new Set();
  if (isVin(niv)) (pIdx.niv[norm(niv)] || []).forEach(r => set.add(r));
  const pl = isPlaca(placaCol) ? placaCol : (isPlaca(niv) ? niv : '');
  if (pl) (pIdx.placa[norm(pl)] || []).forEach(r => set.add(r));
  if (canonPasei(pasei)) (pIdx.pas[canonPasei(pasei)] || []).forEach(r => set.add(r));
  return [...set];
};

const getRows = (t) => retry(() => doc.sheetsByTitle[t].getRows(), 'getRows ' + t);
for (const t of ['Bens_PCDF_1HIGEIA', 'Bens_PCDF_2HIGEIA']) await doc.sheetsByTitle[t].loadHeaderRow();
const H1 = doc.sheetsByTitle['Bens_PCDF_1HIGEIA'].headerValues;
const H2 = doc.sheetsByTitle['Bens_PCDF_2HIGEIA'].headerValues;
const so2 = H2.filter(h => !H1.includes(h) && !['ID'].includes(h)); // colunas só do 2º
const hoje = new Date().toLocaleDateString('pt-BR');

// backup
let r1 = await getRows('Bens_PCDF_1HIGEIA');
let r2 = await getRows('Bens_PCDF_2HIGEIA');
const bkp = (rows, aba) => rows.map(r => [aba, r.rowNumber, ...H2.map(h => JSON.stringify(r.get(h) ?? ''))].join(';'));
writeFileSync(OUTDIR + `/_backup_pre_${APPLY ? 'apply' : 'dry'}_${Date.now()}.csv`,
  ['aba;linha;' + H2.join(';'), ...bkp(r1, '1H'), ...bkp(r2, '2H')].join('\n'));

const keyOf = (r) => { const niv = r.get('NIV'); if (isVin(niv)) return 'V:' + norm(niv); const p = canonPasei(r.get('ID_PASEI')); return p ? 'P:' + p : null; };
const key1set = new Set(r1.map(keyOf).filter(Boolean));

// ── FASE 1: A1 (mover 2º → 1º) ───────────────────────────────────────────────
const A1 = [];
for (const r of r2) {
  const hits = pcdfMatch(r.get('NIV'), r.get('PLACA'), r.get('ID_PASEI'));
  if (hits.length === 0) continue;
  const k = keyOf(r);
  if (k && key1set.has(k)) continue; // já está no 1º → é da fase 2 (dedup)
  A1.push(r);
}
console.log(`FASE 1 (A1 — mover 2º→1º): ${A1.length} linhas`);
const novos1 = A1.map(r => {
  const dobra = so2.map(h => { const v = String(r.get(h) ?? '').trim(); return v ? `[${h}: ${v}]` : ''; }).filter(Boolean).join(' ');
  const obs = `[MOVIDO DO 2º HIGEIA ${hoje}]${dobra ? ' ' + dobra : ''}${r.get('OBSERVACOES') ? ' ' + r.get('OBSERVACOES') : ''}`.trim();
  const o = {};
  for (const h of H1) o[h] = r.get(h) ?? '';
  o.ID = '';
  o.OBSERVACOES = obs;
  o.DESTINACAO = 'RECICLAGEM';
  o.DATA_ATUALIZACAO = hoje;
  return o;
});
if (APPLY && novos1.length) {
  await retry(() => doc.sheetsByTitle['Bens_PCDF_1HIGEIA'].addRows(novos1), 'addRows 1H');
  console.log(`   ✅ ${novos1.length} linhas criadas no 1º`);
  const del = [...A1].sort((a, b) => b.rowNumber - a.rowNumber);
  for (const r of del) { await retry(() => r.delete(), 'del 2H ' + r.rowNumber); await sleep(220); }
  console.log(`   ✅ ${del.length} linhas removidas do 2º`);
}

// ── FASE 2: dedup ───────────────────────────────────────────────────────────
if (APPLY) { r1 = await getRows('Bens_PCDF_1HIGEIA'); r2 = await getRows('Bens_PCDF_2HIGEIA'); }
const todas = [...r1.map(r => ({ r, aba: '1H' })), ...r2.map(r => ({ r, aba: '2H' }))];
const grupos = {};
for (const x of todas) {
  const niv = x.r.get('NIV');
  const pas = canonPasei(x.r.get('ID_PASEI'));
  let k = isVin(niv) ? 'V:' + norm(niv) : (pas ? 'P:' + pas : null);
  if (!k) continue;
  (grupos[k] = grupos[k] || []).push(x);
}
const FIELDS = H1.filter(h => !['ID', 'MODIFICADO_POR', 'RESPONSAVEL_EMAIL', 'ULTIMA_ANALISE'].includes(h));
const score = (r) => FIELDS.reduce((n, h) => n + (String(r.get(h) ?? '').trim() ? 1 : 0), 0)
  + (String(r.get('OBSERVACOES') ?? '').trim().length > 20 ? 1 : 0);
const dups = Object.entries(grupos).filter(([, v]) => {
  if (v.length < 2) return false;
  // se todos têm VIN real e são de processos diferentes com VINs iguais → ok é dup;
  // se agrupou por processo mas os NIVs reais divergem → processo multi-veículo, NÃO é dup
  const vins = v.map(x => norm(x.r.get('NIV'))).filter(n => isVin(n));
  if (vins.length >= 2 && new Set(vins).size > 1) return false;
  return true;
});
let apagar = [], mesclar = [];
for (const [k, v] of dups) {
  const spanBoth = new Set(v.map(x => x.aba)).size > 1;
  // cross-sheet: sobrevivente é sempre o do 1º (o sistema espelha a relação da PCDF);
  // mesmo-aba: sobrevivente é o mais completo
  const ord = spanBoth
    ? [...v].sort((a, b) => (a.aba === '1H' ? -1 : 1) - (b.aba === '1H' ? -1 : 1) || score(b.r) - score(a.r) || a.r.rowNumber - b.r.rowNumber)
    : [...v].sort((a, b) => score(b.r) - score(a.r) || a.r.rowNumber - b.r.rowNumber);
  const keep = ord[0], lose = ord.slice(1);
  const preencher = {};
  for (const h of H1) {
    if (String(keep.r.get(h) ?? '').trim()) continue;
    for (const l of lose) { const val = String(l.r.get(h) ?? '').trim(); if (val) { preencher[h] = val; break; } }
  }
  // dobra colunas-só-do-2º de perdedores que estavam no 2º, no OBSERVACOES do keep
  const extra2 = lose.filter(l => l.aba === '2H').flatMap(l => so2.map(h => { const val = String(l.r.get(h) ?? '').trim(); return val ? `[${h}: ${val}]` : ''; })).filter(Boolean);
  if (extra2.length) preencher.OBSERVACOES = `${keep.r.get('OBSERVACOES') || ''} [DEDUP ${hoje}] ${extra2.join(' ')}`.trim();
  mesclar.push({ k, keep, preencher, nLose: lose.length });
  lose.forEach(l => apagar.push(l));
}
console.log(`\nFASE 2 (dedup): ${dups.length} grupos duplicados → mantém ${dups.length}, apaga ${apagar.length} linha(s)`);
mesclar.slice(0, 12).forEach(m => console.log(`   ${m.k}  mantém ${m.keep.aba} L${m.keep.r.rowNumber} (${m.keep.r.get('ID_LEGADO') || ''})  apaga ${m.nLose}${Object.keys(m.preencher).length ? '  +preenche ' + Object.keys(m.preencher).join(',') : ''}`));
if (dups.length > 12) console.log(`   … +${dups.length - 12} grupos`);
if (APPLY) {
  for (const m of mesclar) {
    if (Object.keys(m.preencher).length) { for (const [h, val] of Object.entries(m.preencher)) m.keep.r.set(h, val); await retry(() => m.keep.r.save(), 'save keep'); await sleep(220); }
  }
  for (const l of [...apagar].sort((a, b) => (a.aba === b.aba ? b.r.rowNumber - a.r.rowNumber : a.aba < b.aba ? 1 : -1))) {
    await retry(() => l.r.delete(), `del ${l.aba} ${l.r.rowNumber}`); await sleep(220);
  }
  console.log(`   ✅ dedup aplicado`);
}

// ── FASE 3: varredura D (todas as abas) — só leitura ─────────────────────────
console.log('\nFASE 3 (varredura dos ausentes em todas as abas)…');
const ABAS = ['Bens_CEGOC', 'Bens_PCDF_1HIGEIA', 'Bens_PCDF_2HIGEIA', 'Bens_DPJ_GC99', 'Bens_Retirados', 'Doacoes_Diligencia', 'Doacoes_Realizadas', 'CaixaEntrada_SEI'];
const gIdx = {};
for (const t of ABAS) {
  const s = doc.sheetsByTitle[t]; if (!s) continue;
  await s.loadHeaderRow();
  const rows = await retry(() => s.getRows(), 'getRows ' + t);
  rows.forEach(r => {
    const niv = r.get('NIV'), placa = r.get('PLACA'), pas = r.get('ID_PASEI') || r.get('PA_PJE');
    const status = r.get('STATUS_DILIGENCIA') || r.get('STATUS_LOCAL_PA') || r.get('MOTIVO_RETIRADA') || r.get('ACAO') || '';
    const tag = `${t} L${r.rowNumber} ${r.get('ID_LEGADO') || ''} (${status})`.trim();
    if (isVin(niv)) (gIdx['V:' + norm(niv)] = gIdx['V:' + norm(niv)] || []).push(tag);
    if (isPlaca(niv)) (gIdx['L:' + norm(niv)] = gIdx['L:' + norm(niv)] || []).push(tag);
    if (isPlaca(placa)) (gIdx['L:' + norm(placa)] = gIdx['L:' + norm(placa)] || []).push(tag);
    if (canonPasei(pas)) (gIdx['P:' + canonPasei(pas)] = gIdx['P:' + canonPasei(pas)] || []).push(tag);
  });
}
const ausentes = pcdf.filter(r => {
  const k = [];
  r._k.nivs.forEach(n => k.push('V:' + n));
  r._k.placas.forEach(p => k.push('L:' + p));
  if (r._k.pas) k.push('P:' + r._k.pas);
  // achou em 1H ou 2H?
  return !k.some(x => (gIdx[x] || []).some(tag => tag.startsWith('Bens_PCDF_1HIGEIA') || tag.startsWith('Bens_PCDF_2HIGEIA')));
});
const cq = c => { c = String(c ?? ''); return /[",;\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; };
const linhas = [['PROCESSO_SEI', 'TIPO_PCDF', 'MARCA_MODELO', 'ANO_FABR', 'COR', 'PLACA_OSTENTADA', 'PLACA_ORIGINAL', 'NIV_OSTENTADO', 'NIV_ORIGINAL', 'RENAVAM', 'PESO_KG_EST', 'PATIO', 'LEILAO', 'RESTRICAO', 'ENCONTRADO_EM'].join(';')];
for (const r of ausentes) {
  const k = [...r._k.nivs.map(n => 'V:' + n), ...r._k.placas.map(p => 'L:' + p), ...(r._k.pas ? ['P:' + r._k.pas] : [])];
  const achado = [...new Set(k.flatMap(x => gIdx[x] || []))].join('  |  ') || 'NÃO ENCONTRADO EM NENHUMA ABA';
  linhas.push([r.PROCESSO_SEI, r.TIPO, r.MARCA_MODELO, '', r.COR, r.PLACA_OSTENTADA, r.PLACA_ORIGINAL, r.NIV_OSTENTADO, r.NIV_ORIGINAL, '', r.PESO_KG_EST, r.PATIO_ORIGEM, r.LEILAO, r.RESTRICAO, achado].map(cq).join(';'));
}
writeFileSync(OUTDIR + '/D_cadastro_e_varredura.csv', linhas.join('\n'));
const soFora = ausentes.filter(r => {
  const k = [...r._k.nivs.map(n => 'V:' + n), ...r._k.placas.map(p => 'L:' + p), ...(r._k.pas ? ['P:' + r._k.pas] : [])];
  return !k.some(x => gIdx[x]);
});
console.log(`   ${ausentes.length} itens da PCDF ausentes do HIGEIA`);
console.log(`   → ${ausentes.length - soFora.length} aparecem em outra aba (CEGOC/DPJ/Retirados/…)`);
console.log(`   → ${soFora.length} não aparecem em NENHUMA aba (cadastro faltando)`);
console.log(`   CSV: SIGNU_CSVs/analise_TJDFT/D_cadastro_e_varredura.csv`);

console.log(APPLY ? '\n✅ CONCLUÍDO.' : '\n👁  DRY-RUN concluído. Rode com --apply para gravar as fases 1 e 2.');
