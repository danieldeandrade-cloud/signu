// lib/googleDrive.js
//
// Client do Google Drive via Service Account.
// Armazena arquivos numa pasta compartilhada com a service account,
// usando Properties personalizadas (signu_lista, signu_row) para rastrear
// a qual bem cada arquivo pertence.
//
// Variáveis de ambiente necessárias:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_PRIVATE_KEY
//   GOOGLE_DRIVE_FOLDER_ID  — ID da pasta "SIGNU_Anexos" no Drive
//                             (compartilhar a pasta com a service account)

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';

function getDriveAuth() {
  if (
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !process.env.GOOGLE_PRIVATE_KEY ||
    !process.env.GOOGLE_DRIVE_FOLDER_ID
  ) {
    throw new Error(
      'Variáveis GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY e GOOGLE_DRIVE_FOLDER_ID não configuradas.'
    );
  }

  return new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getDriveAuth() });
}

/**
 * Faz upload de um arquivo para a pasta SIGNU_Anexos.
 * Adiciona propriedades signu_lista e signu_row para facilitar a busca.
 */
export async function uploadAnexo({ lista, rowNumber, nome, mimeType, buffer }) {
  const drive = getDrive();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: nome,
      parents: [folderId],
      properties: {
        signu_lista:    lista,
        signu_row:      String(rowNumber),
      },
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name, mimeType, size, createdTime, webViewLink',
  });

  return res.data;
}

/**
 * Lista os arquivos de um bem específico.
 */
export async function listarAnexos({ lista, rowNumber }) {
  const drive = getDrive();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const res = await drive.files.list({
    q: [
      `'${folderId}' in parents`,
      `properties has { key='signu_lista' and value='${lista}' }`,
      `properties has { key='signu_row' and value='${String(rowNumber)}' }`,
      `trashed = false`,
    ].join(' and '),
    fields: 'files(id, name, mimeType, size, createdTime, webViewLink)',
    orderBy: 'createdTime desc',
  });

  return res.data.files || [];
}

/**
 * Remove um arquivo pelo ID.
 */
export async function deletarAnexo(fileId) {
  const drive = getDrive();
  await drive.files.delete({ fileId });
  return { ok: true };
}
