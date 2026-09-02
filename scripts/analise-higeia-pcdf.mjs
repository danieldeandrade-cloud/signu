/**
 * scripts/analise-higeia-pcdf.mjs  — SÓ LEITURA
 *
 * Relatório de reconciliação do 1º/2º HIGEIA (estado atual) contra a relação
 * oficial da PCDF (TJDFT.xlsx). Casa por:
 *   - NIV (chassi 16–18)
 *   - placa
 *   - nº do processo (ID_PASEI canônico  N/AAAA)
 *   - QUALQUER nº de processo citado no OBSERVACOES (cobre o "PA Barramento FIB",
 *     que na PCDF costuma ser o processo principal do bem)
 *
 * Gera os CSVs em SIGNU_CSVs/analise_TJDFT/ e o B em .xlsx.
 *   node scripts/analise-higeia-pcdf.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import xlsx from 'xlsx';

const __dir = dirname(fileURLToPath(import.meta.url));
for (const l of readFileSync(resolve(__dir, '../.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}
const PCDF_JSON = '/private/tmp/claude-501/-Users-danielcarneiromendesdeandrade-signu/2c5e73ce-1790-4d41-b72c-ecc733721107/scratchpad/tjdft_pcdf.json';
const OUT = resolve(__dir, '../SIGNU_CSVs/analise_TJDFT');
mkdirSync(OUT, { recursive: true });

const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const isVin = s => { const n = norm(s); return n.length >= 16 && n.length <= 18 && /[0-9]/.test(n) && /[A-Z]/.test(n); };
const isPlaca = s => /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/.test(norm(s));
const canonPasei = s => { const m = String(s || '').match(/(\d{2,7})\s*\/\s*(20\d{2})/); return m ? `${parseInt(m[1], 10)}/${m[2]}` : ''; };
const allPasei = s => { const out = []; const re = /(\d{2,7})\s*\/\s*(20\d{2})/g; let m; while ((m = re.exec(String(s || '')))) out.push(`${parseInt(m[1], 10)}/${m[2]}`); return [...new Set(out)]; };
const DESC = new Set(['DESCONHECIDO', 'DESCONHECIDA', 'NAOHA', 'NA', 'X', 'SUPRIMIDO', 'SEMPLACA', 'SEMPLACAS', 'XXX', '']);
const clean = s => { const v = norm(s); return DESC.has(v) ? '' : String(s || '').trim(); };
const cq = c => { c = String(c ?? ''); return /[",;\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; };

// ── PCDF ─────────────────────────────────────────────────────────────────────
const pcdfRaw = JSON.parse(readFileSync(PCDF_JSON));
const idx = { niv: {}, pla: {}, pas: {} };
pcdfRaw.forEach((r, i) => {
  r._i = i;
  const nivs = [r.NIV_OSTENTADO, r.NIV_ORIGINAL].map(clean).filter(isVin).map(norm);
  const placas = [r.PLACA_OSTENTADA, r.PLACA_ORIGINAL].map(clean).filter(isPlaca).map(norm);
  const pas = canonPasei(r.PROCESSO_SEI);
  r._k = { nivs, placas, pas };
  nivs.forEach(n => (idx.niv[n] = idx.niv[n] || []).push(i));
  placas.forEach(p => (idx.pla[p] = idx.pla[p] || []).push(i));
  if (pas) (idx.pas[pas] = idx.pas[pas] || []).push(i);
});
// itens PCDF distintos (junta linhas repetidas do arquivo pela mesma chave forte)
const pcdfKey = r => (r._k.nivs[0] ? 'V' + r._k.nivs[0] : r._k.placas[0] ? 'L' + r._k.placas[0] : r._k.pas ? 'P' + r._k.pas : 'i' + r._i);
const pcdfDistintos = new Map();
pcdfRaw.forEach(r => { const k = pcdfKey(r); if (!pcdfDistintos.has(k)) pcdfDistintos.set(k, r); });

function matchPcdf({ niv, placa, pasei, obs }) {
  const set = new Set();
  if (isVin(niv)) (idx.niv[norm(niv)] || []).forEach(i => set.add(i));
  const pl = isPlaca(placa) ? placa : (isPlaca(niv) ? niv : '');
  if (pl) (idx.pla[norm(pl)] || []).forEach(i => set.add(i));
  const pasList = new Set([canonPasei(pasei), ...allPasei(obs)].filter(Boolean));
  const viaObs = [];
  for (const p of pasList) (idx.pas[p] || []).forEach(i => { set.add(i); if (p !== canonPasei(pasei)) viaObs.push({ p, i }); });
  return { hits: [...set], viaObs };
}

// ── Sistema (estado atual) ──────────────────────────────────────────────────
const auth = new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();
const carregar = async (t) => { const s = doc.sheetsByTitle[t]; await s.loadHeaderRow(); return { s, rows: await s.getRows(), H: s.headerValues }; };
const { rows: r1, H: H1 } = await carregar('Bens_PCDF_1HIGEIA');
const { rows: r2 } = await carregar('Bens_PCDF_2HIGEIA');

const infoRow = (r, aba) => ({
  aba, row: r.rowNumber, id: r.get('ID_LEGADO') || '', tipo: r.get('TIPO_BEM') || '',
  pasei: r.get('ID_PASEI') || '', niv: r.get('NIV') || '', placa: r.get('PLACA') || '',
  deposito: r.get('DEPOSITO') || '', resp: r.get('RESPONSAVEL') || '', status: r.get('STATUS_DILIGENCIA') || '',
  fib: r.get('FIB') || '', oficio: r.get('OFICIO_BAIXA') || '', inutil: r.get('INUTILIZADO') || '',
  peso: r.get('PESO_KG') || '', dcad: r.get('DATA_CADASTRO') || '', datu: r.get('DATA_ATUALIZACAO') || '',
  obs: r.get('OBSERVACOES') || '',
});

const pcdfCoberto = new Set();   // índices PCDF cobertos por alguma linha do 1º
const pcdfEm2 = new Set();        // idem, mas só por linha do 2º
const C = [], B = [], A = [];
for (const r of r1) {
  const x = infoRow(r, '1H');
  const { hits, viaObs } = matchPcdf(x);
  if (hits.length) { hits.forEach(i => pcdfCoberto.add(i)); const vo = viaObs[0]; C.push({ ...x, via: vo ? 'PROCESSO no OBS (' + vo.p + ')' : 'NIV/placa/processo', pcdf: pcdfRaw[hits[0]] }); }
  else B.push(x);
}
for (const r of r2) {
  const x = infoRow(r, '2H');
  const { hits } = matchPcdf(x);
  if (hits.length) { hits.forEach(i => pcdfEm2.add(i)); A.push({ ...x, pcdf: pcdfRaw[hits[0]] }); }
}
// D = itens PCDF distintos não cobertos por 1º nem 2º
const D = [...pcdfDistintos.values()].filter(r => {
  const ks = [...r._k.nivs, ...r._k.placas, r._k.pas].filter(Boolean);
  const anyIdx = new Set();
  r._k.nivs.forEach(n => (idx.niv[n] || []).forEach(i => anyIdx.add(i)));
  r._k.placas.forEach(p => (idx.pla[p] || []).forEach(i => anyIdx.add(i)));
  if (r._k.pas) (idx.pas[r._k.pas] || []).forEach(i => anyIdx.add(i));
  return ![...anyIdx].some(i => pcdfCoberto.has(i) || pcdfEm2.has(i));
});

// varredura de D em todas as abas (onde está, se está)
const ABAS = ['Bens_CEGOC', 'Bens_DPJ_GC99', 'Bens_Retirados', 'Doacoes_Diligencia', 'Doacoes_Realizadas', 'CaixaEntrada_SEI'];
const gIdx = {};
for (const t of ABAS) {
  const s = doc.sheetsByTitle[t]; if (!s) continue; await s.loadHeaderRow();
  (await s.getRows()).forEach(r => {
    const niv = r.get('NIV'), placa = r.get('PLACA'), pas = r.get('ID_PASEI') || r.get('PA_PJE');
    const st = r.get('STATUS_DILIGENCIA') || r.get('STATUS_LOCAL_PA') || r.get('MOTIVO_RETIRADA') || r.get('ACAO') || '';
    const tag = `${t} L${r.rowNumber} ${r.get('ID_LEGADO') || ''} (${st})`.replace(/\s+/g, ' ').trim();
    const ks = [];
    if (isVin(niv)) ks.push('V' + norm(niv));
    if (isPlaca(niv)) ks.push('L' + norm(niv));
    if (isPlaca(placa)) ks.push('L' + norm(placa));
    allPasei([pas, r.get('OBSERVACOES')].join(' ')).forEach(p => ks.push('P' + p));
    ks.forEach(k => (gIdx[k] = gIdx[k] || []).push(tag));
  });
}
const achaEmOutras = r => {
  const ks = [...r._k.nivs.map(n => 'V' + n), ...r._k.placas.map(p => 'L' + p), ...(r._k.pas ? ['P' + r._k.pas] : [])];
  return [...new Set(ks.flatMap(k => gIdx[k] || []))];
};

// ── Saída ───────────────────────────────────────────────────────────────────
const totalPcdf = pcdfDistintos.size;
console.log('════════ RECONCILIAÇÃO HIGEIA × RELAÇÃO PCDF (estado atual) ════════\n');
console.log(`Relação da PCDF (TJDFT.xlsx): ${pcdfRaw.length} linhas → ${totalPcdf} itens distintos`);
console.log(`Sistema: Bens_PCDF_1HIGEIA ${r1.length} · Bens_PCDF_2HIGEIA ${r2.length}\n`);
console.log(`C) no 1º HIGEIA e na relação da PCDF (conferem) ......... ${C.length}`);
console.log(`     ├─ casaram pelo processo principal / NIV / placa ... ${C.filter(c => !c.via.startsWith('PROCESSO no OBS')).length}`);
console.log(`     └─ casaram pelo "PA Barramento FIB" (nº no OBS) .... ${C.filter(c => c.via.startsWith('PROCESSO no OBS')).length}`);
console.log(`B) no 1º HIGEIA e FORA da relação da PCDF (revisar) ..... ${B.length}`);
console.log(`A) ainda no 2º HIGEIA mas consta no 1º da PCDF .......... ${A.length}`);
console.log(`D) na relação da PCDF sem nenhuma linha no HIGEIA ....... ${D.length}`);
const dEmOutras = D.filter(r => achaEmOutras(r).length);
console.log(`     ├─ aparece em CEGOC/DPJ/Retirados/… ............... ${dEmOutras.length}`);
console.log(`     └─ não aparece em NENHUMA aba (cadastro faltando) . ${D.length - dEmOutras.length}`);
console.log(`\nCobertura da relação PCDF pelo 1º HIGEIA: ${C.length}/${totalPcdf} = ${Math.round(C.length / totalPcdf * 100)}%`);

// CSVs
const wcsv = (nome, header, linhas) => writeFileSync(OUT + '/' + nome, [header.join(';'), ...linhas.map(l => l.map(cq).join(';'))].join('\n'));

wcsv('C_conferem_ok.csv',
  ['linha_1H', 'ID_LEGADO', 'ID_PASEI', 'tipo', 'NIV', 'placa', 'responsavel', 'casou_por', 'PROCESSO_PCDF', 'TIPO_PCDF'],
  C.map(c => [c.row, c.id, c.pasei, c.tipo, c.niv, c.placa, c.resp, c.via, c.pcdf.PROCESSO_SEI, c.pcdf.TIPO]));

wcsv('A_no_2H_consta_no_1H_PCDF.csv',
  ['linha_2H', 'ID_LEGADO', 'ID_PASEI', 'tipo', 'NIV', 'responsavel', 'PROCESSO_PCDF', 'TIPO_PCDF'],
  A.map(a => [a.row, a.id, a.pasei, a.tipo, a.niv, a.resp, a.pcdf.PROCESSO_SEI, a.pcdf.TIPO]));

// D com flag "já está no 1º sob outro processo?"
const dRows = D.map(r => {
  const outras = achaEmOutras(r);
  return [r.PROCESSO_SEI, r.TIPO, r.MARCA_MODELO, r.COR, r.PLACA_OSTENTADA, r.PLACA_ORIGINAL, r.NIV_OSTENTADO, r.NIV_ORIGINAL, r.PESO_KG_EST, r.PATIO_ORIGEM, r.LEILAO, r.RESTRICAO, outras.join(' | ') || 'NÃO ENCONTRADO EM NENHUMA ABA'];
});
wcsv('D_cadastro_e_varredura.csv',
  ['PROCESSO_SEI', 'TIPO_PCDF', 'MARCA_MODELO', 'COR', 'PLACA_OSTENTADA', 'PLACA_ORIGINAL', 'NIV_OSTENTADO', 'NIV_ORIGINAL', 'PESO_KG_EST', 'PATIO', 'LEILAO', 'RESTRICAO', 'ENCONTRADO_EM'],
  dRows);

// B — com colunas de análise, "realmente fora" no topo
const bCols = ['LINHA_ATUAL', 'ID_LEGADO', 'ID_PASEI', 'TIPO_BEM', 'NIV', 'PLACA', 'DEPOSITO', 'RESPONSAVEL', 'STATUS_DILIGENCIA', 'FIB', 'OFICIO_BAIXA', 'INUTILIZADO', 'PESO_KG', 'DATA_CADASTRO', 'DATA_ATUALIZACAO', 'CONSTA_NA_RELACAO_PCDF', 'PROCESSO_PCDF', 'TIPO_PCDF', 'OBSERVACOES'];
const bBody = B.map(x => {
  // reavalia: algum processo do OBS bate com a PCDF? (então NÃO é "fora", é divergência de nº)
  const pasList = new Set(allPasei(x.obs).filter(p => p && p !== canonPasei(x.pasei)));
  let hit = null;
  for (const p of pasList) { const arr = idx.pas[p]; if (arr && arr.length) { hit = pcdfRaw[arr[0]]; break; } }
  return { x, hit, row: [x.row, x.id, x.pasei, x.tipo, x.niv, x.placa, x.deposito, x.resp, x.status, x.fib, x.oficio, x.inutil, x.peso, x.dcad, x.datu, hit ? 'SIM — via PA Barramento FIB' : 'não localizado', hit ? hit.PROCESSO_SEI : '', hit ? hit.TIPO : '', x.obs] };
});
bBody.sort((a, b) => (a.hit ? 1 : 0) - (b.hit ? 1 : 0) || a.x.row - b.x.row);
wcsv('B_no_1H_fora_da_lista_PCDF.csv', bCols, bBody.map(b => b.row));
const wb = xlsx.utils.book_new();
const ws = xlsx.utils.aoa_to_sheet([bCols, ...bBody.map(b => b.row)]);
ws['!cols'] = bCols.map(c => ({ wch: c === 'OBSERVACOES' ? 70 : /PASEI|PROCESSO_PCDF/.test(c) ? 22 : c === 'NIV' ? 20 : c === 'CONSTA_NA_RELACAO_PCDF' ? 26 : c === 'RESPONSAVEL' ? 16 : 12 }));
ws['!autofilter'] = { ref: xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: bBody.length, c: bCols.length - 1 } }) };
ws['!freeze'] = { xSplit: 0, ySplit: 1 };
xlsx.utils.book_append_sheet(wb, ws, 'B - fora da relacao PCDF');
xlsx.writeFile(wb, OUT + '/B_no_1H_fora_da_lista_PCDF.xlsx');
const bReal = bBody.filter(b => !b.hit).length;
console.log(`\nArquivos regravados em SIGNU_CSVs/analise_TJDFT/:`);
console.log(`  B_no_1H_fora_da_lista_PCDF.csv / .xlsx  — ${B.length} linhas (${bReal} realmente fora, ${B.length - bReal} são divergência de nº de processo)`);
console.log(`  C_conferem_ok.csv, A_no_2H_consta_no_1H_PCDF.csv, D_cadastro_e_varredura.csv`);
