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

function diasSemAnalise(item) {
  const campo = item.ULTIMA_ANALISE || item.ultimaAnalise || '';
  if (!campo) return null;
  const ultima = new Date(campo);
  if (isNaN(ultima.getTime())) return null;
  return Math.floor((Date.now() - ultima.getTime()) / (1000 * 60 * 60 * 24));
}

function corStatus(status) {
  const mapa = {
    'ATRASADO':            '#dc2626',
    'PRAZO 6 MESES':       '#d97706',
    'EM DILIGÊNCIA':       '#2563eb',
    'AGUARDANDO':          '#6b7280',
    'BAIXADO':             '#22c55e',
    'LPC':                 '#7c3aed',
    'CATÁLOGO':            '#0891b2',
    'RENAJUD':             '#be185d',
    'EM DILIGÊNCIA HIGEIA':'#7c3aed',
  };
  return mapa[status] || '#6b7280';
}

function badgeDias(dias) {
  if (dias === null) return '<span style="color:#9ca3af;font-size:11px">—</span>';
  const cor = dias >= 30 ? '#dc2626' : dias >= 15 ? '#d97706' : '#22c55e';
  return `<span style="background:${cor}20;color:${cor};padding:2px 7px;border-radius:12px;font-size:11px;font-weight:700">${dias}d</span>`;
}

function htmlGestor(porServidor, todosItens) {
  const data = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  // ── Totais por status (visão geral) ────────────────────────────────────────
  const contagemStatus = {};
  todosItens.forEach(b => {
    contagemStatus[b.status] = (contagemStatus[b.status] || 0) + 1;
  });
  const statusOrdem = ['ATRASADO','PRAZO 6 MESES','EM DILIGÊNCIA','AGUARDANDO','LPC','CATÁLOGO','RENAJUD','EM DILIGÊNCIA HIGEIA','BAIXADO'];
  const resumoStatusHtml = statusOrdem
    .filter(s => contagemStatus[s])
    .map(s => `
      <td style="padding:12px 16px;text-align:center;border-right:1px solid #f3f4f6">
        <div style="font-size:18px;font-weight:800;color:${corStatus(s)}">${contagemStatus[s]}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:3px;text-transform:uppercase;letter-spacing:.04em">${s}</div>
      </td>
    `).join('');

  // ── Tabela por servidor ─────────────────────────────────────────────────────
  const linhasServidor = Object.entries(porServidor).map(([nome, dados]) => {
    const statusCols = statusOrdem
      .filter(s => contagemStatus[s])
      .map(s => {
        const n = dados.porStatus[s] || 0;
        return `<td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f3f4f6;font-size:13px;color:${n>0?corStatus(s):'#d1d5db'};font-weight:${n>0?700:400}">${n||'–'}</td>`;
      }).join('');
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:600;white-space:nowrap">${nome}</td>
        <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:700;color:#111827">${dados.total}</td>
        ${statusCols}
      </tr>
    `;
  }).join('');

  const headerStatusCols = statusOrdem
    .filter(s => contagemStatus[s])
    .map(s => `<th style="padding:8px 12px;text-align:center;font-size:10px;color:${corStatus(s)};text-transform:uppercase;letter-spacing:.05em;white-space:nowrap">${s}</th>`)
    .join('');

  // ── Itens ATRASADO ordenados por dias sem análise ──────────────────────────
  const atrasados = todosItens
    .filter(b => b.status === 'ATRASADO')
    .map(b => ({ ...b, dias: diasSemAnalise(b._raw) }))
    .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));

  const linhasAtrasados = atrasados.map(b => `
    <tr>
      <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:11px;color:#2563eb">${b.id}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:12px">${b.lista}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:12px">${b.tipo}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:600">${b.responsavel}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;text-align:center">${badgeDias(b.dias)}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:760px;margin:0 auto">
      <div style="background:#0a1628;padding:24px 32px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:12px">
        <span style="font-size:24px">⚖️</span>
        <div>
          <div style="color:#c9a84c;font-weight:800;font-size:18px">SIGNU · Resumo Semanal de Gestão</div>
          <div style="color:rgba(255,255,255,0.45);font-size:12px;margin-top:2px">${data}</div>
        </div>
      </div>
      <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">

        <!-- Totais por status -->
        <p style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">Panorama geral — ${todosItens.length} itens monitorados</p>
        <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:10px;overflow:hidden;margin-bottom:28px">
          <tr>${resumoStatusHtml}</tr>
        </table>

        <!-- Tabela por servidor -->
        <p style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">Distribuição por servidor</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Servidor</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase">Total</th>
              ${headerStatusCols}
            </tr>
          </thead>
          <tbody>${linhasServidor}</tbody>
        </table>

        <!-- Itens atrasados por dias -->
        ${atrasados.length > 0 ? `
        <p style="font-size:12px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">⚠️ ${atrasados.length} itens ATRASADOS — ordenados por dias sem análise</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <thead>
            <tr style="background:#fef2f2">
              <th style="padding:7px 12px;text-align:left;font-size:10px;color:#dc2626;text-transform:uppercase">ID</th>
              <th style="padding:7px 12px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase">Lista</th>
              <th style="padding:7px 12px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase">Tipo</th>
              <th style="padding:7px 12px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase">Responsável</th>
              <th style="padding:7px 12px;text-align:center;font-size:10px;color:#6b7280;text-transform:uppercase">Sem análise</th>
            </tr>
          </thead>
          <tbody>${linhasAtrasados}</tbody>
        </table>
        ` : ''}

        <div style="text-align:center;margin-top:8px">
          <a href="https://signu-seven.vercel.app/gestao" style="background:#0a1628;color:#c9a84c;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            Abrir Gestão →
          </a>
        </div>
        <p style="font-size:11px;color:#9ca3af;margin-top:24px;text-align:center">SIGNU · Sistema de Gestão de Bens · NULEJ/TJDFT</p>
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
    // ── Coleta ─────────────────────────────────────────────────────────────────
    // Para servidores: apenas ATRASADO + 15 dias sem análise (alerta de ação imediata)
    // Para gestores:   TODOS os itens ativos (panorama completo por status)
    const STATUS_ATIVOS = ['AGUARDANDO','EM DILIGÊNCIA','ATRASADO','PRAZO 6 MESES','LPC','CATÁLOGO','RENAJUD','EM DILIGÊNCIA HIGEIA'];

    const todosEmAlerta  = []; // para e-mail dos servidores (filtrado)
    const todosParaGestor = []; // para relatório do gestor (todos os status ativos)

    for (const lista of LISTAS) {
      const rows = await getAllRows(lista.sheetName);
      rows.forEach(r => {
        const status = r[lista.statusField] || '';
        const item = {
          id:          r.ID_LEGADO || r.ID_PASEI || `${lista.nome}-${String(r._rowNumber).padStart(4,'0')}`,
          lista:       lista.nome,
          tipo:        r.TIPO_BEM || '—',
          status,
          responsavel: getNomeResponsavel(r),
          obs:         (r.OBSERVACOES || '').substring(0, 60),
          _raw:        r,
        };
        // Para o e-mail de alerta dos servidores: apenas ATRASADO + sem análise recente
        if (STATUS_ALERTA.includes(status) && semAnaliseRecente(r)) {
          todosEmAlerta.push(item);
        }
        // Para o relatório do gestor: todos os itens com status ativo
        if (STATUS_ATIVOS.includes(status)) {
          todosParaGestor.push(item);
        }
      });
    }

    // ── Agrupamentos ───────────────────────────────────────────────────────────
    const porResponsavel = {};
    todosEmAlerta.forEach(b => {
      const nome = b.responsavel || 'Sem responsável';
      if (!porResponsavel[nome]) porResponsavel[nome] = [];
      porResponsavel[nome].push(b);
    });

    // Para o gestor: conta total e por status de cada servidor
    const porServidorGestor = {};
    Object.keys(SERVIDORES_EMAIL).forEach(nome => {
      porServidorGestor[nome] = { total: 0, porStatus: {} };
    });
    todosParaGestor.forEach(b => {
      const nome = b.responsavel || 'Sem responsável';
      if (!porServidorGestor[nome]) porServidorGestor[nome] = { total: 0, porStatus: {} };
      porServidorGestor[nome].total++;
      porServidorGestor[nome].porStatus[b.status] = (porServidorGestor[nome].porStatus[b.status] || 0) + 1;
    });

    const enviados = [];

    // ── E-mails para servidores (apenas quem tem alertas) ────────────────────
    for (const [nomeServidor, email] of Object.entries(SERVIDORES_EMAIL)) {
      const bensServidor = porResponsavel[nomeServidor] || [];
      if (bensServidor.length === 0) continue;

      const resultado = await enviarEmail({
        para:    email,
        assunto: `⚠️ SIGNU — ${bensServidor.length} bem(ns) com atenção — ${new Date().toLocaleDateString('pt-BR')}`,
        html:    htmlServidor(nomeServidor, bensServidor),
      });
      enviados.push({ para: email, bens: bensServidor.length, ...resultado });
    }

    // ── Relatório semanal para gestores ──────────────────────────────────────
    for (const email of GESTORES_EMAIL) {
      const resultado = await enviarEmail({
        para:    email,
        assunto: `📊 SIGNU — Relatório semanal NULEJ — ${new Date().toLocaleDateString('pt-BR')}`,
        html:    htmlGestor(porServidorGestor, todosParaGestor),
      });
      enviados.push({ para: email, tipo: 'gestor', ...resultado });
    }

    return NextResponse.json({ ok: true, totalAlertas: todosEmAlerta.length, totalMonitorados: todosParaGestor.length, enviados });
  } catch (e) {
    return NextResponse.json({ erro: e.message }, { status: 500 });
  }
}
