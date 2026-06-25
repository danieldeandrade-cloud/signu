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

export async function getAllRows(sheetName) {
  const sheet = await getSheet(sheetName);
  const rows = await sheet.getRows();
  return rows.map((row) => ({
    _rowNumber: row.rowNumber,
    ...row.toObject(),
  }));
}

export async function addRow(sheetName, data) {
  const sheet = await getSheet(sheetName);
  const row = await sheet.addRow(data);
  return { _rowNumber: row.rowNumber, ...row.toObject() };
}

export async function updateRow(sheetName, rowNumber, data) {
  const sheet = await getSheet(sheetName);
  const rows = await sheet.getRows();
  const target = rows.find((r) => r.rowNumber === rowNumber);
  if (!target) {
    throw new Error(`Linha ${rowNumber} não encontrada em "${sheetName}".`);
  }
  Object.entries(data).forEach(([key, value]) => {
    target.set(key, value);
  });
  await target.save();
  return { _rowNumber: target.rowNumber, ...target.toObject() };
}

export async function deleteRow(sheetName, rowNumber) {
  const sheet = await getSheet(sheetName);
  const rows = await sheet.getRows();
  const target = rows.find((r) => r.rowNumber === rowNumber);
  if (!target) {
    throw new Error(`Linha ${rowNumber} não encontrada em "${sheetName}".`);
  }
  await target.delete();
  return { ok: true };
}
