// app/api/notificacoes/route.js
//
// Chamado pelo Vercel Cron Job todo dia às 7h (horário de Brasília = 10h UTC).
// Envia e-mail personalizado para cada servidor com seus bens em atraso/pendentes,
// e um resumo geral para os gestores.
//
// Para acionar manualmente: GET /api/notificacoes?secret=CRON_SECRET

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getAllRows } from '@/lib/googleSheets';
import { SERVIDORES_EMAIL, GESTORES_EMAIL, getNomeResponsavel } from '@/lib/servidores';

// Transporter Gmail — usa App Password (não senha normal)
// Variáveis: GMAIL_USER=signu.sistema@gmail.com  GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
function criarTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

const LISTAS = [
  { nome: 'CEGOC',     sheetName: 'Bens_CEGOC',         statusField: 'STATUS_DILIGENCIA' },
  { nome: 'PCDF 1ª',  sheetName: 'Bens_PCDF_1HIGEIA',  statusField: 'STATUS_DILIGENCIA' },
  { nome: 'PCDF 2ª',  sheetName: 'Bens_PCDF_2HIGEIA',  statusField: 'STATUS_DILIGENCIA' },
  { nome: 'DPJ-GC99', sheetName: 'Bens_DPJ_GC99',       statusField: 'STATUS_DILIGENCIA' },
  { nome: 'Doações',  sheetName: 'Doacoes_Diligencia',  statusField: 'STATUS_LOCAL_PA'   },
];

const STATUS_ALERTA = ['ATRASADO'];
const DIAS_SEM_ANALISE = 15; // notifica apenas se o item não foi analisado nos últimos N dias

function semAnaliseRecente(item) {
  const campo = item.ULTIMA_ANALISE || '';
  if (!campo) return true; // nunca analisado → notifica
  const ultima = new Date(campo);
  if (isNaN(ultima.getTime())) return true;
  const diasPassados = (Date.now() - ultima.getTime()) / (1000 * 60 * 60 * 24);
  return diasPassados >= DIAS_SEM_ANALISE;
}

async function enviarEmail({ para, assunto, html }) {
  const transporter = criarTransporter();
  try {
    await transporter.sendMail({
      from:    `"SIGNU · NULEJ" <${process.env.GMAIL_USER}>`,
      to:      para,
      subject: assunto,
      html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, detalhe: e.message };
  }
}

function tabelaHtml(bens) {
  const linhas = bens.map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;color:#1d4ed8">${b.id}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${b.lista}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${b.tipo}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:${b.status==='ATRASADO'?'#dc2626':'#d97706'};font-weight:700">${b.status}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280">${b.obs}</td>
    </tr>
  `).join('');

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      <thead>
        <tr style="background:#f3f4f6">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">ID</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Lista</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Tipo</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Status</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Observações</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

function htmlServidor(nome, bens) {
  const data = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  return `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:700px;margin:0 auto">
      <div style="background:#0a1628;padding:24px 32px;border-radius:12px 12px 0 0">
        <span style="font-size:24px">⚖️</span>
        <span style="color:#c9a84c;font-weight:800;font-size:18px;margin-left:10px">SIGNU · NULEJ/TJDFT</span>
      </div>
      <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <p style="font-size:15px;color:#111827;margin:0 0 4px">Olá, <strong>${nome.split(' ')[0]}</strong> 👋</p>
        <p style="font-size:13px;color:#6b7280;margin:0 0 20px">${data}</p>
        <p style="font-size:14px;color:#374151">Você tem <strong style="color:#dc2626">${bens.length} bem(ns)</strong> com atenção necessária hoje:</p>
        ${tabelaHtml(bens)}
        <div style="margin-top:24px;text-align:center">
          <a href="https://signu-seven.vercel.app/fila" style="background:#0a1628;color:#c9a84c;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            Abrir Minha Fila →
          </a>
        </div>
        <p style="font-size:11px;color:#9ca3af;margin-top:24px;text-align:center">
          SIGNU · Sistema de Gestão de Bens · NULEJ/TJDFT
        </p>
      </div>
    </div>
  `;
}

function htmlGestor(totalAtrasados, porServidor) {
  const data = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const resumo = Object.entries(porServidor)
    .map(([nome, bens]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600">${nome}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;color:${bens.atrasados>0?'#dc2626':'#22c55e'};font-weight:700">${bens.atrasados}</td>
      </tr>
    `).join('');

  return `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:700px;margin:0 auto">
      <div style="background:#0a1628;padding:24px 32px;border-radius:12px 12px 0 0">
        <span style="font-size:24px">⚖️</span>
        <span style="color:#c9a84c;font-weight:800;font-size:18px;margin-left:10px">SIGNU · Resumo de Gestão</span>
      </div>
      <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <p style="font-size:14px;color:#374151;margin:0 0 4px">Resumo operacional do NULEJ — <strong>${data}</strong></p>
        <p style="font-size:22px;font-weight:800;color:#dc2626;margin:16px 0 4px">${totalAtrasados} bens em alerta</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Servidor</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;color:#dc2626;text-transform:uppercase">Em atraso (+15 dias)</th>
            </tr>
          </thead>
          <tbody>${resumo}</tbody>
        </table>
        <div style="margin-top:24px;text-align:center">
          <a href="https://signu-seven.vercel.app/gestao" style="background:#0a1628;color:#c9a84c;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            Abrir Gestão →
          </a>
        </div>
        <p style="font-size:11px;color:#9ca3af;margin-top:24px;text-align:center">
          SIGNU · Sistema de Gestão de Bens · NULEJ/TJDFT
        </p>
      </div>
    </div>
  `;
}

export async function GET(request) {
  // Vercel Cron injeta o header "Authorization: Bearer <CRON_SECRET>" automaticamente.
  // Para testes manuais, aceita também ?secret=<valor> na query.
  const authHeader = request.headers.get('authorization') || '';
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get('secret');

  const cronSecret = process.env.CRON_SECRET;
  const autorizado =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (cronSecret && querySecret === cronSecret);

  if (!autorizado) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json({ erro: 'GMAIL_USER ou GMAIL_APP_PASSWORD não configuradas' }, { status: 500 });
  }

  try {
    // Coleta todos os bens em alerta de todas as listas
    const todosEmAlerta = [];

    for (const lista of LISTAS) {
      const rows = await getAllRows(lista.sheetName);
      rows.forEach(r => {
        const status = r[lista.statusField] || '';
        if (STATUS_ALERTA.includes(status) && semAnaliseRecente(r)) {
          todosEmAlerta.push({
            id:          r.ID_LEGADO || `${lista.nome}-${String(r._rowNumber).padStart(4,'0')}`,
            lista:       lista.nome,
            tipo:        r.TIPO_BEM || '—',
            status,
            responsavel: getNomeResponsavel(r),
            obs:         (r.OBSERVACOES || '').substring(0, 60),
          });
        }
      });
    }

    // Agrupa por responsável
    const porResponsavel = {};
    todosEmAlerta.forEach(b => {
      const nome = b.responsavel || 'Sem responsável';
      if (!porResponsavel[nome]) porResponsavel[nome] = [];
      porResponsavel[nome].push(b);
    });

    const enviados = [];

    // E-mails personalizados para cada servidor
    for (const [nomeServidor, email] of Object.entries(SERVIDORES_EMAIL)) {
      const bensServidor = porResponsavel[nomeServidor] || [];
      if (bensServidor.length === 0) continue; // não envia se não tiver alertas

      const resultado = await enviarEmail({
        para:    email,
        assunto: `⚠️ SIGNU — ${bensServidor.length} bem(ns) com atenção — ${new Date().toLocaleDateString('pt-BR')}`,
        html:    htmlServidor(nomeServidor, bensServidor),
      });
      enviados.push({ para: email, bens: bensServidor.length, ...resultado });
    }

    // Resumo geral para os gestores
    const porServidorResumo = {};
    Object.entries(SERVIDORES_EMAIL).forEach(([nome]) => {
      const bens = porResponsavel[nome] || [];
      porServidorResumo[nome] = {
        atrasados: bens.length, // só bens ATRASADO +15 dias sem análise chegam aqui
      };
    });

    for (const email of GESTORES_EMAIL) {
      const resultado = await enviarEmail({
        para:    email,
        assunto: `📊 SIGNU — Resumo diário NULEJ — ${new Date().toLocaleDateString('pt-BR')}`,
        html:    htmlGestor(todosEmAlerta.length, porServidorResumo),
      });
      enviados.push({ para: email, tipo: 'gestor', ...resultado });
    }

    return NextResponse.json({ ok: true, totalAlertas: todosEmAlerta.length, enviados });
  } catch (e) {
    return NextResponse.json({ erro: e.message }, { status: 500 });
  }
}
