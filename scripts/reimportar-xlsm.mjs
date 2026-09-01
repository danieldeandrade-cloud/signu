/**
 * scripts/reimportar-xlsm.mjs
 *
 * Reimporta ("extração do zero") os dados do arquivo XLSM para o SIGNU_DB.
 * Substitui TOTALMENTE o conteúdo das 7 abas de bens: limpa da linha 2 pra
 * baixo e reinsere tudo a partir do Excel, com IDs sequenciais recriados.
 *
 * NÃO toca em: Entidades_Credenciadas, Anotacoes_Doacoes, Doacoes_Realizadas.
 *
 * Uso:
 *   node scripts/reimportar-xlsm.mjs                 # DRY-RUN (só relatório)
 *   node scripts/reimportar-xlsm.mjs --apply         # grava na planilha
 *   node scripts/reimportar-xlsm.mjs --apply --keep-headers   # não remove colunas-lixo
 *   node scripts/reimportar-xlsm.mjs --apply --only=cegoc,dpj # subconjunto de abas
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const XLSM = resolve(ROOT, 'GESTÃO DE BENS NULEJ (4).xlsm');

const APPLY        = process.argv.includes('--apply');
const KEEP_HEADERS = process.argv.includes('--keep-headers');
const FOLD_EXTRAS  = !process.argv.includes('--no-fold-extras'); // dobra infos sem coluna em OBSERVACOES
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').replace('--only=', '')
  .split(',').map(s => s.trim()).filter(Boolean);

const HOJE = '2026-09-01';

// ── .env.local ───────────────────────────────────────────────────────────────
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}

// ── helpers ──────────────────────────────────────────────────────────────────
const clean = (v) => {
  if (v == null) return '';
  if (v instanceof Date) return fmtDate(v);
  return String(v).trim();
};
function fmtDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return '';
  if (d.getFullYear() < 1990) return ''; // serial 0 do Excel / datas-lixo
  return d.toISOString().slice(0, 10);
}
const dateCell = (v) => (v instanceof Date ? fmtDate(v) : (/^\d{4}-\d{2}-\d{2}/.test(clean(v)) ? clean(v).slice(0, 10) : clean(v)));

const bool = (v) => {
  const s = clean(v).toUpperCase();
  if (['SIM', 'S', '1', 'TRUE', 'X', 'YES'].includes(s)) return 'TRUE';
  if (['NÃO', 'NAO', 'N', '0', 'FALSE', 'NO'].includes(s)) return 'FALSE';
  return '';
};

const NOMES = {
  AMANDA: 'Amanda Junqueira', CARLINHOS: 'Carlos Caetano', 'LETÍCIA': 'Letícia Mota',
  LETICIA: 'Letícia Mota', LOARA: 'Loara Passo', CARLA: 'Carla Araújo',
  MARCELO: 'Marcelo Oliveira', 'CLÁUDIA': 'Cláudia Santos', CLAUDIA: 'Cláudia Santos',
  DANIEL: 'Daniel Andrade',
};
// placeholders de "não atribuído" → RESPONSAVEL em branco
const NAO_ATRIBUIDO = new Set([
  'NÃO DISTRIBUIR', 'NAO DISTRIBUIR', 'SEM DISTRIB.', 'SEM DISTRIB', 'SEM DISTRIBUIÇÃO',
  'SEM DISTRIBUICAO', 'GESTORES', 'NÃO DISTRIBUÍDO', 'A DISTRIBUIR',
]);
const nomesDesconhecidos = new Set();
function nome(v) {
  const s = clean(v);
  if (!s) return '';
  const up = s.toUpperCase();
  if (NAO_ATRIBUIDO.has(up)) return '';
  if (NOMES[up]) return NOMES[up];
  if (Object.values(NOMES).some(n => n.toUpperCase() === up)) return s;
  nomesDesconhecidos.add(s);
  return s.replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function foldObs(base, extras) {
  const pref = extras.filter(([, v]) => clean(v) && !['N/A', 'N/C', ''].includes(clean(v).toUpperCase()))
    .map(([k, v]) => `[${k}: ${clean(v)}]`).join(' ');
  const b = clean(base);
  if (!FOLD_EXTRAS || !pref) return b;
  return b ? `${pref} ${b}` : pref;
}

function seqId(prefixo, i) {
  return `${prefixo}-${String(i).padStart(4, '0')}`;
}

// ── carrega XLSM ─────────────────────────────────────────────────────────────
const wb = XLSX.readFile(XLSM, { cellDates: true });
const grid = (aba) => XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, raw: true, defval: null, blankrows: true });

// ── definição das 7 abas ────────────────────────────────────────────────────
// cada builder recebe as linhas do Excel e devolve { headers, rows }
const JOBS = {
  cegoc: {
    sheet: 'Bens_CEGOC',
    xlsm: 'GESTÃO DE BENS - CEGOC',
    headers: ['ID','ID_LEGADO','ID_PASEI','TIPO_BEM','NIV','DESTINACAO','STATUS_DILIGENCIA','RESPONSAVEL','RESPONSAVEL_EMAIL','FIB','OBSERVACOES','DATA_CADASTRO','DATA_ATUALIZACAO','MODIFICADO_POR','ULTIMA_ANALISE'],
    build(rows) {
      const out = [];
      let n = 0;
      for (const r of rows.slice(3)) {
        const [ , dest, pasei, tipo, niv, , , status, serv, fib, obs ] = r;
        if (![pasei, tipo, niv].some(clean)) continue;
        if (['PASEI2', 'PASEI', 'CLASSIFICAÇÃO'].includes(clean(pasei))) continue;
        n++;
        out.push({
          ID: seqId('CEG', n), ID_LEGADO: '', ID_PASEI: clean(pasei), TIPO_BEM: clean(tipo).toUpperCase(),
          NIV: clean(niv), DESTINACAO: clean(dest).toUpperCase(),
          STATUS_DILIGENCIA: clean(status).toUpperCase(), RESPONSAVEL: nome(serv), RESPONSAVEL_EMAIL: '',
          FIB: bool(fib), OBSERVACOES: clean(obs), DATA_CADASTRO: HOJE, DATA_ATUALIZACAO: HOJE,
          MODIFICADO_POR: '', ULTIMA_ANALISE: '',
        });
      }
      return out;
    },
  },

  dpj: {
    sheet: 'Bens_DPJ_GC99',
    xlsm: 'GESTÃO DE BENS DPJ - GC99',
    headers: ['ID','LOTE','PA_PJE','TIPO_BEM','NIV','STATUS_DILIGENCIA','DATA_ENTRADA','PRAZO_6MESES','RESPONSAVEL','RESPONSAVEL_EMAIL','MOTIVO_SAIDA','DATA_SAIDA','OBSERVACOES','DATA_CADASTRO','DATA_ATUALIZACAO','MODIFICADO_POR','ULTIMA_ANALISE'],
    build(rows) {
      const out = [];
      let n = 0;
      for (const r of rows.slice(3)) {
        const pasei = r[1], lote = r[2], tipo = r[3], pje = r[4], dtEnt = r[5], prazo = r[6],
          status = r[7], serv = r[8], obs = r[9], dtAtu = r[10], dtSaida = r[12], motSaida = r[13];
        if (![clean(pasei), clean(tipo)].some(Boolean)) continue;
        if (['PASEI', 'PASEI2'].includes(clean(pasei))) continue;
        n++;
        let st = clean(status).toUpperCase();
        if (st === 'DOAÇÃO') st = 'DOAÇÃO EM ANDAMENTO';
        out.push({
          ID: seqId('DPJ', n), LOTE: clean(lote), PA_PJE: clean(pasei), TIPO_BEM: clean(tipo).toUpperCase(),
          NIV: '', STATUS_DILIGENCIA: st, DATA_ENTRADA: dateCell(dtEnt), PRAZO_6MESES: dateCell(prazo),
          RESPONSAVEL: nome(serv), RESPONSAVEL_EMAIL: '', MOTIVO_SAIDA: clean(motSaida).toUpperCase(),
          DATA_SAIDA: dateCell(dtSaida), OBSERVACOES: foldObs(obs, [['PJE', pje]]),
          DATA_CADASTRO: HOJE, DATA_ATUALIZACAO: dateCell(dtAtu) || HOJE, MODIFICADO_POR: '', ULTIMA_ANALISE: '',
        });
      }
      return out;
    },
  },

  pcdf1: {
    sheet: 'Bens_PCDF_1HIGEIA',
    xlsm: 'PCDF 1º HIGEIA',
    headers: ['ID','ID_PASEI','TIPO_BEM','NIV','DEPOSITO','STATUS_DILIGENCIA','RESPONSAVEL','RESPONSAVEL_EMAIL','FIB','CEB_TEP_TIV','OFICIO_BAIXA','INUTILIZADO','PESO_KG','OBSERVACOES','DATA_CADASTRO','DATA_ATUALIZACAO','MODIFICADO_POR','ULTIMA_ANALISE','RESTRICAO_ROUBO'],
    build(rows) {
      const out = [];
      let n = 0;
      for (const r of rows.slice(2)) {
        const pa = r[0], paFib = r[1], serv = r[2], tipo = r[3], niv = r[4], dep = r[5], motivo = r[6],
          obs = r[8], fib = r[9], ceb = r[10], peso = r[11], oficio = r[12], inut = r[13];
        if (![clean(pa), clean(tipo)].some(Boolean)) continue;
        if (['PA ORIGINAL', 'PA BARRAMENTO FIB'].includes(clean(pa).toUpperCase())) continue;
        n++;
        out.push({
          ID: seqId('PCF1', n), ID_PASEI: clean(pa), TIPO_BEM: clean(tipo).toUpperCase(), NIV: clean(niv),
          DEPOSITO: clean(dep).toUpperCase(), STATUS_DILIGENCIA: 'EM DILIGÊNCIA', RESPONSAVEL: nome(serv),
          RESPONSAVEL_EMAIL: '', FIB: bool(fib), CEB_TEP_TIV: bool(ceb), OFICIO_BAIXA: bool(oficio),
          INUTILIZADO: bool(inut), PESO_KG: clean(peso),
          OBSERVACOES: foldObs(obs, [['MOTIVO', motivo], ['PA Barramento FIB', paFib]]),
          DATA_CADASTRO: HOJE, DATA_ATUALIZACAO: HOJE, MODIFICADO_POR: '', ULTIMA_ANALISE: '', RESTRICAO_ROUBO: '',
        });
      }
      return out;
    },
  },

  pcdf2: {
    sheet: 'Bens_PCDF_2HIGEIA',
    xlsm: 'PCDF 2º HIGEIA',
    headers: ['ID','ID_PASEI','TIPO_BEM','NIV','DEPOSITO','STATUS_DILIGENCIA','PA_TJDFT','ORIGEM_CEGOC_ID','RESPONSAVEL','RESPONSAVEL_EMAIL','FIB','CEB_TEP_TIV','OFICIO_BAIXA','INUTILIZADO','RESTRICAO_ROUBO','PESO_KG','OBSERVACOES','DATA_CADASTRO','DATA_ATUALIZACAO','MODIFICADO_POR'],
    build(rows) {
      const out = [];
      let n = 0;
      for (const r of rows.slice(2)) {
        const proc = r[0], paAnexo = r[1], tipo = r[2], niv = r[3], motivo = r[4], dep = r[5],
          restr = r[6], serv = r[7], obs = r[8], fib = r[9], ceb = r[10], peso = r[11], oficio = r[12], inut = r[13];
        if (![clean(proc), clean(tipo)].some(Boolean)) continue;
        if (['PROCESSO FIB', 'PA ORIGINAL'].includes(clean(proc).toUpperCase())) continue;
        n++;
        out.push({
          ID: seqId('PCF2', n), ID_PASEI: clean(proc), TIPO_BEM: clean(tipo).toUpperCase(), NIV: clean(niv),
          DEPOSITO: clean(dep).toUpperCase(), STATUS_DILIGENCIA: 'EM DILIGÊNCIA', PA_TJDFT: clean(paAnexo),
          ORIGEM_CEGOC_ID: '', RESPONSAVEL: nome(serv), RESPONSAVEL_EMAIL: '', FIB: bool(fib),
          CEB_TEP_TIV: bool(ceb), OFICIO_BAIXA: bool(oficio), INUTILIZADO: bool(inut),
          RESTRICAO_ROUBO: bool(restr), PESO_KG: clean(peso),
          OBSERVACOES: foldObs(obs, [['MOTIVO', motivo]]),
          DATA_CADASTRO: HOJE, DATA_ATUALIZACAO: HOJE, MODIFICADO_POR: '',
        });
      }
      return out;
    },
  },

  sei: {
    sheet: 'CaixaEntrada_SEI',
    xlsm: 'CAIXA DO SEI - temporária',
    headers: ['ID','ID_PASEI','TIPO_BEM','NIV','ACAO','RESPONSAVEL','RESPONSAVEL_EMAIL','OBSERVACOES','DATA_CADASTRO','DATA_ATUALIZACAO','MODIFICADO_POR'],
    build(rows) {
      const out = [];
      let n = 0;
      for (const r of rows.slice(2)) {
        const pasei = r[1], serv = r[2], obs = r[3];
        if (!clean(pasei) || clean(pasei).toUpperCase() === 'PASEI') continue;
        n++;
        out.push({
          ID: seqId('SEI', n), ID_PASEI: clean(pasei), TIPO_BEM: '', NIV: '', ACAO: 'DILIGÊNCIA',
          RESPONSAVEL: nome(serv), RESPONSAVEL_EMAIL: '', OBSERVACOES: clean(obs),
          DATA_CADASTRO: HOJE, DATA_ATUALIZACAO: HOJE, MODIFICADO_POR: '',
        });
      }
      return out;
    },
  },

  doacoes_diligencia: {
    sheet: 'Doacoes_Diligencia',
    xlsm: 'DOAÇÃO novo método',
    headers: ['ID','ID_PASEI','TIPO_BEM','NIV','ENTIDADE_ID','ENTIDADE_NOME','STATUS_LOCAL_PA','RESPONSAVEL','RESPONSAVEL_EMAIL','OBSERVACOES','DATA_CADASTRO','DATA_ATUALIZACAO','MODIFICADO_POR'],
    build(rows) {
      const out = [];
      let n = 0;
      // bloco principal (colunas A-I)
      for (const r of rows.slice(3)) {
        const dtDec = r[0], entidade = r[2], proc = r[3], tipo = r[4], status = r[5], resp = r[6], dtAtu = r[7], obs = r[8];
        if (![clean(proc), clean(entidade)].some(Boolean)) continue;
        if (['PROCESSO', 'DATA DA DECISÃO'].includes(clean(proc).toUpperCase())) continue;
        n++;
        out.push({
          ID: seqId('DOA', n), ID_PASEI: clean(proc), TIPO_BEM: clean(tipo).toUpperCase(), NIV: '',
          ENTIDADE_ID: '', ENTIDADE_NOME: clean(entidade), STATUS_LOCAL_PA: clean(status).toUpperCase(),
          RESPONSAVEL: nome(resp), RESPONSAVEL_EMAIL: '', OBSERVACOES: clean(obs),
          DATA_CADASTRO: dateCell(dtDec) || HOJE, DATA_ATUALIZACAO: dateCell(dtAtu) || HOJE, MODIFICADO_POR: '',
        });
      }
      // bloco secundário (colunas K-P): "em diligência para desvinculação de débitos"
      for (const r of rows) {
        const dt = r[10], lote = r[11], resp = r[12], proc = r[13], tipo = r[14], obs = r[15];
        if (!clean(proc) || clean(proc).toUpperCase() === 'PROCESSO') continue;
        if (!clean(obs)) continue;
        n++;
        out.push({
          ID: seqId('DOA', n), ID_PASEI: clean(proc), TIPO_BEM: clean(tipo).toUpperCase(), NIV: '',
          ENTIDADE_ID: '', ENTIDADE_NOME: '', STATUS_LOCAL_PA: '',
          RESPONSAVEL: nome(resp), RESPONSAVEL_EMAIL: '',
          OBSERVACOES: foldObs(obs, [['LOTE', lote]]),
          DATA_CADASTRO: dateCell(dt) || HOJE, DATA_ATUALIZACAO: HOJE, MODIFICADO_POR: '',
        });
      }
      return out;
    },
  },

  retirados: {
    sheet: 'Bens_Retirados',
    xlsm: 'RETIRADOS - CIRCULAÇÃO',
    headers: ['ID','ID_PASEI','TIPO_BEM','NIV','MOTIVO_RETIRADA','LISTA_ORIGEM','DATA_RETIRADA','RESPONSAVEL','RESPONSAVEL_EMAIL','OBSERVACOES','DATA_CADASTRO'],
    build(rows) {
      const out = [];
      let n = 0;
      for (const r of rows.slice(3)) {
        const pasei = r[1], dest = r[2], tipo = r[3], niv = r[4], leilao = r[6], serv = r[7], obs = r[8], saida = r[12];
        if (![clean(pasei), clean(tipo)].some(Boolean)) continue;
        if (['PASEI', 'PASEI2'].includes(clean(pasei).toUpperCase())) continue;
        n++;
        out.push({
          ID: seqId('RET', n), ID_PASEI: clean(pasei), TIPO_BEM: clean(tipo).toUpperCase(), NIV: clean(niv),
          MOTIVO_RETIRADA: clean(dest).toUpperCase(), LISTA_ORIGEM: 'CEGOC', DATA_RETIRADA: dateCell(saida),
          RESPONSAVEL: nome(serv), RESPONSAVEL_EMAIL: '',
          OBSERVACOES: foldObs(obs, [['LEILÃO', leilao]]),
          DATA_CADASTRO: HOJE,
        });
      }
      return out;
    },
  },
};

// ── execução ────────────────────────────────────────────────────────────────
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
await doc.loadInfo();

console.log(`\n📋 ${doc.title}`);
console.log(APPLY ? '🚀 MODO: APLICAR (vai sobrescrever as abas)\n' : '👁  MODO: DRY-RUN — nada será gravado. Use --apply para gravar.\n');
console.log(`   fold-extras (dobra infos sem coluna em OBSERVACOES): ${FOLD_EXTRAS ? 'ON' : 'OFF'}`);
console.log(`   limpar colunas-lixo do cabeçalho: ${KEEP_HEADERS ? 'NÃO' : 'SIM'}\n`);

const jobs = Object.entries(JOBS).filter(([k]) => !ONLY.length || ONLY.includes(k));

for (const [key, job] of jobs) {
  const sheet = doc.sheetsByTitle[job.sheet];
  if (!sheet) { console.log(`⚠️  ${job.sheet}: aba não encontrada — pulando`); continue; }
  await sheet.loadHeaderRow().catch(() => {});
  const antes = (await sheet.getRows()).length;
  const novos = job.build(grid(job.xlsm));

  const hdrAtual = sheet.headerValues || [];
  const hdrNovo = KEEP_HEADERS ? hdrAtual : job.headers;
  const removidas = hdrAtual.filter(h => !hdrNovo.includes(h));

  console.log(`\n### ${key}  →  ${job.sheet}`);
  console.log(`   linhas: ${antes} (atual)  →  ${novos.length} (novo)`);
  if (removidas.length) console.log(`   colunas removidas do cabeçalho: ${removidas.join(', ')}`);
  console.log(`   1ª linha nova: ${JSON.stringify(novos[0])}`);
  console.log(`   última:        ${JSON.stringify(novos[novos.length - 1])}`);

  if (APPLY) {
    if (!KEEP_HEADERS && removidas.length) await sheet.setHeaderRow(hdrNovo);
    await sheet.clearRows();
    // grava em lotes de 500 pra não estourar limites
    for (let i = 0; i < novos.length; i += 500) {
      await sheet.addRows(novos.slice(i, i + 500), { raw: true });
    }
    console.log(`   💾 ${novos.length} linhas gravadas.`);
  }
}

if (nomesDesconhecidos.size) {
  console.log(`\n⚠️  RESPONSAVEL não mapeados (mantidos em Title Case): ${[...nomesDesconhecidos].join(', ')}`);
}
console.log(`\n${'─'.repeat(60)}`);
console.log(APPLY ? '✅ Concluído.' : '👁  Dry-run concluído. Revise acima e rode com --apply.');
