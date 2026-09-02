// app/api/notificacoes/route.js
//
// Chamado pelo Vercel Cron Job (seg–sex às 10h UTC = 7h Brasília).
// - E-mail individual para cada servidor com seus itens ativos parados há +N dias.
// - Resumo semanal para os gestores: panorama por status, quebra por LISTA,
//   distribuição por servidor (itens por lista) e fila de doação.
//
// Acionar manualmente: GET /api/notificacoes?secret=CRON_SECRET

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getAllRows } from '@/lib/googleSheets';
import { SERVIDORES_EMAIL, GESTORES_EMAIL, getNomeResponsavel } from '@/lib/servidores';

function criarTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

const LISTAS = [
  { nome: 'CEGOC',     sheetName: 'Bens_CEGOC',        statusField: 'STATUS_DILIGENCIA' },
  { nome: 'PCDF 1ª',  sheetName: 'Bens_PCDF_1HIGEIA', statusField: 'STATUS_DILIGENCIA' },
  { nome: 'PCDF 2ª',  sheetName: 'Bens_PCDF_2HIGEIA', statusField: 'STATUS_DILIGENCIA' },
  { nome: 'DPJ-GC99', sheetName: 'Bens_DPJ_GC99',      statusField: 'STATUS_DILIGENCIA' },
  { nome: 'Doações',  sheetName: 'Doacoes_Diligencia', statusField: 'STATUS_LOCAL_PA'   },
];
const LISTA_NOMES = LISTAS.map(l => l.nome);

const DIAS_SEM_ANALISE     = 21;  // servidor é avisado se o item não é mexido há N dias
const MAX_ALERTAS_SERVIDOR = 25;  // teto de linhas no e-mail individual

// O e-mail INDIVIDUAL do servidor fica suspenso até esta data. Motivo: logo após a
// migração o ULTIMA_ANALISE está vazio e o DATA_ATUALIZACAO é uniforme, então o
// primeiro envio seria dominado por backlog herdado. Dá tempo da equipe rodar o
// sistema ~30 dias; depois disso volta a enviar normalmente. O resumo dos gestores
// continua saindo toda semana.
const ALERTA_SERVIDOR_ATIVO_EM = new Date('2026-10-02T00:00:00-03:00');

// Status que significam trabalho encerrado — ficam fora do relatório
const STATUS_ENCERRADO = ['RETIRADO', 'BAIXADO', 'CONCLUÍDO', 'CONCLUIDO', 'CANCELADO', 'ARQUIVADO', 'DOAÇÃO REALIZADA'];
const estaAtivo = (status) => {
  const s = String(status || '').toUpperCase().trim();
  return s !== '' && !STATUS_ENCERRADO.includes(s);
};

// Colunas de status "operacionais" mostradas na matriz por lista / panorama
const STATUS_PRINCIPAIS = ['EM DILIGÊNCIA', 'EM DILIGÊNCIA HIGEIA', 'PRAZO 6 MESES', 'LPC', 'CATÁLOGO', 'RENAJUD'];

// Converte data (ISO, aaaa-mm-dd ou dd/mm/aaaa) em ms; 0 se não der
function parseDataFlex(v) {
  if (!v) return 0;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  const d = new Date(s);
  return isNaN(d) ? 0 : d.getTime();
}

// Dias desde a última mexida conhecida (ULTIMA_ANALISE → DATA_ATUALIZACAO → DATA_CADASTRO)
function diasSemMexida(item) {
  const t =
    parseDataFlex(item.ULTIMA_ANALISE) ||
    parseDataFlex(item.DATA_ATUALIZACAO) ||
    parseDataFlex(item.DATA_CADASTRO);
  if (!t) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

async function enviarEmail({ para, assunto, html }) {
  const transporter = criarTransporter();
  try {
    await transporter.sendMail({
      from: `"SIGNU · NULEJ" <${process.env.GMAIL_USER}>`,
      to: para,
      subject: assunto,
      html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, detalhe: e.message };
  }
}

function corStatus(status) {
  const mapa = {
    'ATRASADO': '#dc2626',
    'PRAZO 6 MESES': '#d97706',
    'EM DILIGÊNCIA': '#2563eb',
    'EM DILIGÊNCIA HIGEIA': '#7c3aed',
    'AGUARDANDO': '#6b7280',
    'AGUARDANDO ENTIDADE': '#6b7280',
    'AGUARDANDO APTIDÃO': '#d97706',
    'EM ANÁLISE': '#2563eb',
    'BAIXADO': '#22c55e',
    'LPC': '#7c3aed',
    'CATÁLOGO': '#0891b2',
    'RENAJUD': '#be185d',
    'DOAÇÃO EM ANDAMENTO': '#0d9488',
    'ENTIDADE': '#0d9488',
    'DPJ': '#64748b',
    'SEMA': '#64748b',
    'SGC': '#64748b',
    'GC': '#64748b',
  };
  return mapa[status] || '#6b7280';
}

function badgeDias(dias) {
  if (dias === null || dias === undefined) return '<span style="color:#9ca3af;font-size:11px">—</span>';
  const cor = dias >= 60 ? '#dc2626' : dias >= 30 ? '#d97706' : '#22c55e';
  return `<span style="background:${cor}20;color:${cor};padding:2px 7px;border-radius:12px;font-size:11px;font-weight:700">${dias}d</span>`;
}

// ───────────────────────── E-MAIL DO SERVIDOR ─────────────────────────

function tabelaAlertaHtml(bens) {
  const th = (t) => `<th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">${t}</th>`;
  const linhas = bens.map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;color:#1d4ed8">${b.id}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${b.lista}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${b.tipo}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:${corStatus(b.status)};font-weight:700">${b.status}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${badgeDias(b.dias)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280">${b.obs}</td>
    </tr>`).join('');
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      <thead><tr style="background:#f3f4f6">
        ${th('ID')}${th('Lista')}${th('Tipo')}${th('Status')}${th('Parado há')}${th('Observações')}
      </tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

function htmlServidor(nome, bens, totalAlertas) {
  const data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const extra = totalAlertas > bens.length ? ` (mostrando os ${bens.length} mais parados)` : '';
  return `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:700px;margin:0 auto">
      <div style="background:#0a1628;padding:24px 32px;border-radius:12px 12px 0 0">
        <span style="font-size:24px">⚖️</span>
        <span style="color:#c9a84c;font-weight:800;font-size:18px;margin-left:10px">SIGNU · NULEJ/TJDFT</span>
      </div>
      <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <p style="font-size:15px;color:#111827;margin:0 0 4px">Olá, <strong>${nome.split(' ')[0]}</strong> 👋</p>
        <p style="font-size:13px;color:#6b7280;margin:0 0 20px">${data}</p>
        <p style="font-size:14px;color:#374151">Você tem <strong style="color:#dc2626">${totalAlertas} item(ns)</strong> sem atualização há mais de ${DIAS_SEM_ANALISE} dias${extra}:</p>
        ${tabelaAlertaHtml(bens)}
        <div style="margin-top:24px;text-align:center">
          <a href="https://signu-seven.vercel.app/fila" style="background:#0a1628;color:#c9a84c;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Abrir Minha Fila →</a>
        </div>
        <p style="font-size:11px;color:#9ca3af;margin-top:24px;text-align:center">SIGNU · Sistema de Gestão de Bens · NULEJ/TJDFT</p>
      </div>
    </div>`;
}

// ───────────────────────── E-MAIL DO GESTOR ─────────────────────────

function htmlGestor({ porServidor, porLista, filaDoacao, itensAtivos }) {
  const data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  // Contagem global por status
  const contagemStatus = {};
  itensAtivos.forEach(b => { contagemStatus[b.status] = (contagemStatus[b.status] || 0) + 1; });
  const statusPresentes = STATUS_PRINCIPAIS.filter(s => contagemStatus[s]);
  const outrosStatus = Object.keys(contagemStatus).filter(s => !STATUS_PRINCIPAIS.includes(s));
  const totalOutros = outrosStatus.reduce((n, s) => n + contagemStatus[s], 0);

  // ── Panorama por status ──
  const panoramaCards = [
    ...statusPresentes.map(s => ({ label: s, n: contagemStatus[s], cor: corStatus(s) })),
    ...(totalOutros ? [{ label: 'OUTROS', n: totalOutros, cor: '#6b7280' }] : []),
  ].map(c => `
    <td style="padding:12px 16px;text-align:center;border-right:1px solid #f3f4f6">
      <div style="font-size:18px;font-weight:800;color:${c.cor}">${c.n}</div>
      <div style="font-size:10px;color:#6b7280;margin-top:3px;text-transform:uppercase;letter-spacing:.04em">${c.label}</div>
    </td>`).join('');

  // ── Quebra por LISTA (Total + status principais + Outros) ──
  const colsLista = [...statusPresentes, ...(totalOutros ? ['OUTROS'] : [])];
  const thLista = `
    <tr style="background:#f3f4f6">
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Lista</th>
      <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase">Total</th>
      ${colsLista.map(s => `<th style="padding:8px 12px;text-align:center;font-size:10px;color:${corStatus(s)};text-transform:uppercase;white-space:nowrap">${s}</th>`).join('')}
    </tr>`;
  const trLista = LISTA_NOMES.map(nome => {
    const d = porLista[nome] || { total: 0, porStatus: {} };
    const cel = colsLista.map(s => {
      const n = s === 'OUTROS'
        ? outrosStatus.reduce((acc, k) => acc + (d.porStatus[k] || 0), 0)
        : (d.porStatus[s] || 0);
      return `<td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f3f4f6;font-size:13px;color:${n > 0 ? corStatus(s) : '#d1d5db'};font-weight:${n > 0 ? 700 : 400}">${n || '–'}</td>`;
    }).join('');
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:600">${nome}</td>
        <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:700;color:#111827">${d.total}</td>
        ${cel}
      </tr>`;
  }).join('');

  // ── Distribuição por servidor (itens por LISTA) ──
  const thServidor = `
    <tr style="background:#f3f4f6">
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Servidor</th>
      <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase">Total</th>
      ${LISTA_NOMES.map(n => `<th style="padding:8px 12px;text-align:center;font-size:10px;color:#6b7280;text-transform:uppercase;white-space:nowrap">${n}</th>`).join('')}
    </tr>`;
  const nomesOrdenados = Object.keys(porServidor).sort((a, b) => {
    if (a === 'Sem responsável') return 1;
    if (b === 'Sem responsável') return -1;
    return (porServidor[b].total || 0) - (porServidor[a].total || 0);
  });
  const trServidor = nomesOrdenados.map(nome => {
    const d = porServidor[nome];
    const semResp = nome === 'Sem responsável';
    const cel = LISTA_NOMES.map(ln => {
      const n = d.porLista[ln] || 0;
      return `<td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f3f4f6;font-size:13px;color:${n > 0 ? '#111827' : '#d1d5db'};font-weight:${n > 0 ? 600 : 400}">${n || '–'}</td>`;
    }).join('');
    return `
      <tr${semResp ? ' style="background:#fef2f2"' : ''}>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:${semResp ? 700 : 600};color:${semResp ? '#dc2626' : '#111827'};white-space:nowrap">${nome}</td>
        <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:700;color:${semResp ? '#dc2626' : '#111827'}">${d.total}</td>
        ${cel}
      </tr>`;
  }).join('');

  // ── Fila de doação (por STATUS_LOCAL_PA) ──
  const filaLinhas = Object.entries(filaDoacao.porStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `
      <tr>
        <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:600;color:${corStatus(s)}">${s}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;text-align:center;font-size:13px;font-weight:700">${n}</td>
      </tr>`).join('');
  const filaHtml = filaDoacao.total > 0 ? `
    <p style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">Fila de doação — ${filaDoacao.total} processo(s)</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:7px 12px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase">Situação (Status Local PA)</th>
        <th style="padding:7px 12px;text-align:center;font-size:10px;color:#6b7280;text-transform:uppercase">Qtd.</th>
      </tr></thead>
      <tbody>${filaLinhas}</tbody>
    </table>` : '';

  // ── Itens parados há +N dias ──
  const parados = itensAtivos
    .filter(b => b.dias !== null && b.dias >= DIAS_SEM_ANALISE)
    .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));
  const paradosTop = parados.slice(0, 30);
  const linhasParados = paradosTop.map(b => `
    <tr>
      <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:11px;color:#2563eb">${b.id}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:12px">${b.lista}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:12px">${b.tipo}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:600">${b.responsavel || '—'}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;text-align:center">${badgeDias(b.dias)}</td>
    </tr>`).join('');
  const paradosHtml = parados.length > 0 ? `
    <p style="font-size:12px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">⚠️ ${parados.length} itens sem atualização há +${DIAS_SEM_ANALISE} dias${parados.length > paradosTop.length ? ` (top ${paradosTop.length})` : ''}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr style="background:#fef2f2">
        <th style="padding:7px 12px;text-align:left;font-size:10px;color:#dc2626;text-transform:uppercase">ID</th>
        <th style="padding:7px 12px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase">Lista</th>
        <th style="padding:7px 12px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase">Tipo</th>
        <th style="padding:7px 12px;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase">Responsável</th>
        <th style="padding:7px 12px;text-align:center;font-size:10px;color:#6b7280;text-transform:uppercase">Parado há</th>
      </tr></thead>
      <tbody>${linhasParados}</tbody>
    </table>` : '';

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

        <p style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">Panorama geral — ${itensAtivos.length} itens ativos monitorados</p>
        <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:10px;overflow:hidden;margin-bottom:28px">
          <tr>${panoramaCards}</tr>
        </table>

        <p style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">Por lista</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
          <thead>${thLista}</thead>
          <tbody>${trLista}</tbody>
        </table>

        <p style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px">Distribuição por servidor (itens ativos por lista)</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
          <thead>${thServidor}</thead>
          <tbody>${trServidor}</tbody>
        </table>

        ${filaHtml}
        ${paradosHtml}

        <div style="text-align:center;margin-top:8px">
          <a href="https://signu-seven.vercel.app/gestao" style="background:#0a1628;color:#c9a84c;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Abrir Gestão →</a>
        </div>
        <p style="font-size:11px;color:#9ca3af;margin-top:24px;text-align:center">SIGNU · Sistema de Gestão de Bens · NULEJ/TJDFT</p>
      </div>
    </div>`;
}

// ───────────────────────── HANDLER ─────────────────────────

export async function GET(request) {
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
    const itensAtivos = [];
    const porLista = {};
    LISTA_NOMES.forEach(n => { porLista[n] = { total: 0, porStatus: {} }; });
    const filaDoacao = { total: 0, porStatus: {} };

    for (const lista of LISTAS) {
      const rows = await getAllRows(lista.sheetName);
      const ehDoacao = lista.nome === 'Doações';
      rows.forEach(r => {
        const status = (r[lista.statusField] || '').trim();
        // Doações é fila de trabalho inteira; nas demais listas entram só os não-encerrados
        if (!ehDoacao && !estaAtivo(status)) return;

        const item = {
          id: r.ID_LEGADO || r.ID_PASEI || `${lista.nome}-${String(r._rowNumber).padStart(4, '0')}`,
          lista: lista.nome,
          tipo: r.TIPO_BEM || '—',
          status: status || '(sem status)',
          responsavel: getNomeResponsavel(r),
          obs: (r.OBSERVACOES || '').substring(0, 60),
          dias: diasSemMexida(r),
          _raw: r,
        };
        itensAtivos.push(item);
        porLista[lista.nome].total++;
        porLista[lista.nome].porStatus[item.status] = (porLista[lista.nome].porStatus[item.status] || 0) + 1;
        if (ehDoacao) {
          filaDoacao.total++;
          filaDoacao.porStatus[item.status] = (filaDoacao.porStatus[item.status] || 0) + 1;
        }
      });
    }

    // Distribuição por servidor: total + itens por lista
    const porServidor = {};
    Object.keys(SERVIDORES_EMAIL).forEach(nome => {
      porServidor[nome] = { total: 0, porLista: {} };
    });
    itensAtivos.forEach(b => {
      const nome = b.responsavel || 'Sem responsável';
      if (!porServidor[nome]) porServidor[nome] = { total: 0, porLista: {} };
      porServidor[nome].total++;
      porServidor[nome].porLista[b.lista] = (porServidor[nome].porLista[b.lista] || 0) + 1;
    });
    // Remove servidores sem nenhum item (mantém só quem tem carga)
    Object.keys(porServidor).forEach(nome => {
      if (porServidor[nome].total === 0) delete porServidor[nome];
    });

    // Alertas por servidor: itens ativos, com responsável, parados há +N dias
    const porResponsavel = {};
    itensAtivos
      .filter(b => b.responsavel && b.dias !== null && b.dias >= DIAS_SEM_ANALISE)
      .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0))
      .forEach(b => { (porResponsavel[b.responsavel] ||= []).push(b); });

    const enviados = [];
    const alertaServidorLiberado = Date.now() >= ALERTA_SERVIDOR_ATIVO_EM.getTime();

    if (alertaServidorLiberado) {
      for (const [nomeServidor, email] of Object.entries(SERVIDORES_EMAIL)) {
        const todos = porResponsavel[nomeServidor] || [];
        if (todos.length === 0) continue;
        const resultado = await enviarEmail({
          para: email,
          assunto: `⚠️ SIGNU — ${todos.length} item(ns) parado(s) — ${new Date().toLocaleDateString('pt-BR')}`,
          html: htmlServidor(nomeServidor, todos.slice(0, MAX_ALERTAS_SERVIDOR), todos.length),
        });
        enviados.push({ para: email, itens: todos.length, ...resultado });
      }
    }

    for (const email of GESTORES_EMAIL) {
      const resultado = await enviarEmail({
        para: email,
        assunto: `📊 SIGNU — Relatório semanal NULEJ — ${new Date().toLocaleDateString('pt-BR')}`,
        html: htmlGestor({ porServidor, porLista, filaDoacao, itensAtivos }),
      });
      enviados.push({ para: email, tipo: 'gestor', ...resultado });
    }

    return NextResponse.json({
      ok: true,
      totalMonitorados: itensAtivos.length,
      porLista: Object.fromEntries(LISTA_NOMES.map(n => [n, porLista[n].total])),
      filaDoacao: filaDoacao.total,
      servidoresComAlerta: Object.keys(porResponsavel).length,
      alertaIndividualSuspensoAte: alertaServidorLiberado ? null : '2026-10-02',
      enviados,
    });
  } catch (e) {
    return NextResponse.json({ erro: e.message }, { status: 500 });
  }
}
