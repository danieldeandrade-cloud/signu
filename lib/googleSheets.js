// lib/googleSheets.js
//
// Client central de conexão com a planilha SIGNU_DB no Google Sheets.
// Usa autenticação via Service Account (sem login de usuário, sem OAuth interativo).
//
// Variáveis de ambiente necessárias (ver .env.local.example):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_PRIVATE_KEY
//   GOOGLE_SHEET_ID

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let docInstance = null;
let docLoadedAt = null;
const CACHE_TTL_MS = 60 * 1000; // recarrega metadados da planilha a cada 60s

async function getDoc() {
  const agora = Date.now();
  if (docInstance && docLoadedAt && agora - docLoadedAt < CACHE_TTL_MS) {
    return docInstance;
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
    throw new Error(
      'Variáveis de ambiente do Google Sheets não configuradas. Verifique GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY e GOOGLE_SHEET_ID no .env.local'
    );
  }

  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();

  docInstance = doc;
  docLoadedAt = agora;
  return doc;
}

export async function getSheet(sheetName) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[sheetName];
  if (!sheet) {
    throw new Error(
      `Aba "${sheetName}" não encontrada na planilha SIGNU_DB. Abas disponíveis: ${Object.keys(doc.sheetsByTitle).join(', ')}`
    );
  }
  return sheet;
}

// Cache curto das LINHAS de cada aba (não só dos metadados, como getDoc()).
// Sem isso, cada tela que abre N cards/itens e cada um deles varre as 6
// listas (duplicidade + distribuição automática) dispara N×6 leituras quase
// simultâneas — já estourou a cota "Read requests per minute per user" do
// Sheets com ~10 itens pendentes na revisão da importação SEI. TTL curto
// (15s) só absorve rajadas de leitura no mesmo carregamento de página;
// qualquer escrita invalida a cota daquela aba na hora, então não fica
// desatualizado por muito tempo.
const rowsCache = new Map(); // sheetName -> { rows, at }
const ROWS_CACHE_TTL_MS = 15 * 1000;

async function getCachedRows(sheetName) {
  const cache = rowsCache.get(sheetName);
  const agora = Date.now();
  if (cache && agora - cache.at < ROWS_CACHE_TTL_MS) {
    return cache.rows;
  }
  const sheet = await getSheet(sheetName);
  const rows = await sheet.getRows();
  rowsCache.set(sheetName, { rows, at: agora });
  return rows;
}

function invalidarCache(sheetName) {
  rowsCache.delete(sheetName);
}

export async function getAllRows(sheetName) {
  const rows = await getCachedRows(sheetName);
  return rows.map((row) => ({
    _rowNumber: row.rowNumber,
    ...row.toObject(),
  }));
}

export async function addRow(sheetName, data) {
  const sheet = await getSheet(sheetName);
  const agora = new Date().toLocaleDateString('pt-BR');
  const row = await sheet.addRow({
    ...data,
    DATA_CADASTRO:     data.DATA_CADASTRO     || agora,
    DATA_ATUALIZACAO:  data.DATA_ATUALIZACAO  || agora,
  });
  invalidarCache(sheetName);
  return { _rowNumber: row.rowNumber, ...row.toObject() };
}

export async function updateRow(sheetName, rowNumber, data) {
  const rows = await getCachedRows(sheetName);
  const target = rows.find((r) => r.rowNumber === rowNumber);
  if (!target) {
    throw new Error(`Linha ${rowNumber} não encontrada em "${sheetName}".`);
  }

  // Visto/não visto: se o item está sendo reatribuído pra outra pessoa, ou
  // editado por alguém que não é o responsável atual (gestor, automação SEI,
  // outro servidor), limpa VISTO_EM — o responsável ainda não viu essa
  // mudança, então o item deve voltar a aparecer como "novo" pra ele.
  const responsavelAtual = (target.get('RESPONSAVEL') ?? target.get('Responsavel') ?? '').toString().trim();
  const responsavelNovo = (data.RESPONSAVEL ?? data.Responsavel ?? responsavelAtual).toString().trim();
  const autor = (data.MODIFICADO_POR ?? '').toString().trim();
  const mudouResponsavel = responsavelNovo && responsavelNovo !== responsavelAtual;
  const editadoPorOutraPessoa = autor && responsavelNovo && autor !== responsavelNovo;
  if (mudouResponsavel || editadoPorOutraPessoa) {
    data = { ...data, VISTO_EM: '' };
  }

  Object.entries(data).forEach(([key, value]) => {
    target.set(key, value);
  });
  // Sempre registra a data da última atualização
  target.set('DATA_ATUALIZACAO', new Date().toLocaleDateString('pt-BR'));
  await target.save();
  invalidarCache(sheetName);
  return { _rowNumber: target.rowNumber, ...target.toObject() };
}

export async function deleteRow(sheetName, rowNumber) {
  const rows = await getCachedRows(sheetName);
  const target = rows.find((r) => r.rowNumber === rowNumber);
  if (!target) {
    throw new Error(`Linha ${rowNumber} não encontrada em "${sheetName}".`);
  }
  await target.delete();
  invalidarCache(sheetName);
  return { ok: true };
}

// Define um único campo sem tocar em DATA_ATUALIZACAO/MODIFICADO_POR — usado
// pra ações que não são "edição de dado" de verdade (ex.: marcar como visto),
// pra não mascarar itens realmente parados (diasSemMexida usa DATA_ATUALIZACAO)
// nem gerar ruído no log de produtividade.
export async function setCampoSemRastro(sheetName, rowNumber, campo, valor) {
  const rows = await getCachedRows(sheetName);
  const target = rows.find((r) => r.rowNumber === rowNumber);
  if (!target) {
    throw new Error(`Linha ${rowNumber} não encontrada em "${sheetName}".`);
  }
  target.set(campo, valor);
  await target.save();
  invalidarCache(sheetName);
  return { _rowNumber: target.rowNumber, ...target.toObject() };
}
