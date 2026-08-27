/**
 * SIGNU — Relatório Semanal de Gestão
 * Google Apps Script
 *
 * Substitui o flow NULEJ_Relatorio_Semanal_Teams do Power Automate.
 * Lê diretamente o SIGNU_DB no Google Sheets e envia o relatório
 * de gestão geral toda quarta-feira às 07h40.
 *
 * COMO INSTALAR:
 *   1. Abra o Google Sheets do SIGNU_DB
 *   2. Extensões → Apps Script
 *   3. Crie um novo arquivo: "+" → Script → nome: relatorio_gestao
 *   4. Cole este código
 *   5. Salve e configure o gatilho semanal (instruções no final)
 */

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────

const GESTAO_CONFIG = {
  SHEET_ID: '1i-VMH3A_-snUICXtA26BKiZ0uAzxhGdVgqlAh4T6hhc',

  DESTINATARIOS: [
    'daniel.andrade@tjdft.jus.br',
    'carlos.amorim@tjdft.jus.br',
  ],

  // Listas que entram no panorama geral
  LISTAS_OPERACIONAIS: [
    { aba: 'Bens_CEGOC',        label: 'CEGOC'          },
    { aba: 'Bens_PCDF_1HIGEIA', label: 'PCDF 1ª HIGEIA' },
    { aba: 'Bens_PCDF_2HIGEIA', label: 'PCDF 2ª HIGEIA' },
    { aba: 'Bens_DPJ_GC99',     label: 'DPJ GC99'       },
    { aba: 'CaixaEntrada_SEI',  label: 'SEI'            },
    { aba: 'Doacoes_Diligencia',label: 'Doações'        },
  ],

  // Categorias de STATUS_DILIGENCIA e DESTINACAO que aparecem no panorama
  // A chave é o valor exato na planilha, o label é o que aparece no email
  CATEGORIAS: [
    { campo: 'STATUS_DILIGENCIA', valor: 'PRAZO 6 MESES',          label: 'PRAZO 6 MESES',     cor: '#c9a84c' },
    { campo: 'STATUS_DILIGENCIA', valor: 'EM DILIGÊNCIA',           label: 'EM DILIGÊNCIA',     cor: '#2563eb' },
    { campo: 'DESTINACAO',        valor: 'LPC',                     label: 'LPC',               cor: '#7c3aed' },
    { campo: 'DESTINACAO',        valor: 'CATÁLOGO',                label: 'CATÁLOGO',          cor: '#059669' },
    { campo: 'DESTINACAO',        valor: 'RENAJUD',                 label: 'RENAJUD',           cor: '#dc2626' },
    { campo: 'DESTINACAO',        valor: 'EM DILIGÊNCIA HIGEIA',    label: 'EM DIG. HIGEIA',    cor: '#a21caf' },
  ],

  SERVIDORES: [
    'Amanda Junqueira',
    'Carla Araújo',
    'Carlos Caetano',
    'Cláudia Santos',
    'Letícia Mota',
    'Loara Passo',
    'Marcelo Oliveira',
  ],
};

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────────────

function enviarRelatorioGestao() {
  const planilha = SpreadsheetApp.openById(GESTAO_CONFIG.SHEET_ID);
  const hoje     = new Date();

  // Estrutura de totais
  const panorama    = {};   // { 'EM DILIGÊNCIA': 880, 'LPC': 1, ... }
  const porServidor = {};   // { 'Carla Araújo': { total: 174, 'EM DILIGÊNCIA': 153, ... } }
  const porLista    = {};   // { 'CEGOC': 577, 'PCDF 1ª HIGEIA': 551, ... }
  let   totalGeral  = 0;

  GESTAO_CONFIG.CATEGORIAS.forEach(c => { panorama[c.label] = 0; });
  GESTAO_CONFIG.SERVIDORES.forEach(s => {
    porServidor[s] = { total: 0 };
    GESTAO_CONFIG.CATEGORIAS.forEach(c => { porServidor[s][c.label] = 0; });
  });

  // ── Lê cada lista ────────────────────────────────────────────────────────────
  GESTAO_CONFIG.LISTAS_OPERACIONAIS.forEach(({ aba, label }) => {
    const sheet = planilha.getSheetByName(aba);
    if (!sheet) { Logger.log(`Aba "${aba}" não encontrada — pulando.`); return; }

    const dados = sheet.getDataRange().getValues();
    if (dados.length < 2) return;

    const cabecalhos   = dados[0].map(h => String(h).trim());
    const col          = nome => cabecalhos.indexOf(nome);
    const iResponsavel = col('Responsavel');
    const iStatus      = col('STATUS_DILIGENCIA');
    const iDestinacao  = col('DESTINACAO');

    let totalLista = 0;

    for (let i = 1; i < dados.length; i++) {
      const linha       = dados[i];
      const responsavel = String(linha[iResponsavel] || '').trim();
      const status      = String(linha[iStatus]      || '').trim();
      const destinacao  = String(linha[iDestinacao]  || '').trim();

      if (!responsavel && !status && !destinacao) continue;

      totalGeral++;
      totalLista++;

      // Acumula por categoria
      GESTAO_CONFIG.CATEGORIAS.forEach(({ campo, valor, label: catLabel }) => {
        const valorLinha = campo === 'STATUS_DILIGENCIA' ? status : destinacao;
        if (valorLinha === valor) {
          panorama[catLabel]++;
          if (porServidor[responsavel]) {
            porServidor[responsavel][catLabel]++;
          }
        }
      });

      // Total por servidor
      if (porServidor[responsavel]) {
        porServidor[responsavel].total++;
      }
    }

    porLista[label] = totalLista;
  });

  // ── Monta e envia ─────────────────────────────────────────────────────────
  const html    = gerarHtmlGestao(panorama, porServidor, porLista, totalGeral, hoje);
  const assunto = `SIGNU — Relatório semanal · ${formatarDataGestao(hoje)}`;

  GmailApp.sendEmail(
    GESTAO_CONFIG.DESTINATARIOS.join(','),
    assunto,
    'Este email requer um cliente com suporte a HTML.',
    { htmlBody: html, name: 'SIGNU · NULEJ' }
  );

  Logger.log(`Relatório de gestão enviado · ${formatarDataGestao(hoje)}`);
}

// ─── GERAÇÃO DO HTML ──────────────────────────────────────────────────────────

function gerarHtmlGestao(panorama, porServidor, porLista, totalGeral, hoje) {
  const diaSemana = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'][hoje.getDay()];
  const meses     = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const dataExtenso = `${diaSemana}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  // ── Cards do panorama ────────────────────────────────────────────────────
  const cardsHtml = GESTAO_CONFIG.CATEGORIAS.map(({ label, cor }) => `
    <td align="center" style="background:#f8fafc;border:1px solid #e2e8f0;border-top:3px solid ${cor};border-radius:8px;padding:14px 6px;width:16%;">
      <div style="font-size:26px;font-weight:bold;color:${cor};">${panorama[label] || 0}</div>
      <div style="font-size:9px;color:#64748b;font-weight:bold;letter-spacing:1px;margin-top:4px;">${label}</div>
    </td>
    <td width="1%"></td>`
  ).join('');

  // ── Cabeçalhos da tabela ─────────────────────────────────────────────────
  const thCategorias = GESTAO_CONFIG.CATEGORIAS.map(({ label, cor }) =>
    `<th style="padding:10px 7px;text-align:center;font-size:10px;color:${cor};font-weight:bold;letter-spacing:1px;border-bottom:2px solid #c9a84c;">${label.replace(' ', '<br>')}</th>`
  ).join('');

  // ── Linhas por servidor ──────────────────────────────────────────────────
  let linhasHtml = '';
  GESTAO_CONFIG.SERVIDORES.forEach((nome, idx) => {
    const d     = porServidor[nome] || { total: 0 };
    const fundo = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    const primeiroNome = nome.split(' ')[0];

    const celulas = GESTAO_CONFIG.CATEGORIAS.map(({ label, cor }) => {
      const val = d[label] || 0;
      return `<td style="padding:10px 7px;text-align:center;font-size:13px;color:${val > 0 ? cor : '#cbd5e1'};font-weight:${val > 0 ? 'bold' : 'normal'};">${val > 0 ? val : '—'}</td>`;
    }).join('');

    linhasHtml += `
      <tr style="background:${fundo};border-bottom:1px solid #e2e8f0;">
        <td style="padding:11px 14px;font-size:13px;font-weight:600;color:#0a1628;border-left:3px solid #c9a84c;">${primeiroNome}<br><span style="font-size:11px;font-weight:400;color:#64748b;">${nome.split(' ').slice(1).join(' ')}</span></td>
        <td style="padding:11px 8px;text-align:center;font-size:14px;font-weight:bold;color:#0a1628;">${d.total || 0}</td>
        ${celulas}
      </tr>`;
  });

  // Linha de total
  const celulasTotais = GESTAO_CONFIG.CATEGORIAS.map(({ label, cor }) =>
    `<td style="padding:12px 7px;text-align:center;font-size:13px;font-weight:bold;color:${cor};">${panorama[label] || 0}</td>`
  ).join('');

  // ── Totais por lista (resumo inferior) ───────────────────────────────────
  const listasResumoHtml = Object.entries(porLista).map(([label, total], idx) => {
    const fundo = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
    return `
      <tr style="background:${fundo};border-bottom:1px solid #e2e8f0;">
        <td style="padding:9px 14px;font-size:13px;font-weight:600;color:#0a1628;border-left:3px solid #c9a84c;">${label}</td>
        <td style="padding:9px 8px;text-align:center;font-size:14px;font-weight:bold;color:#0a1628;">${total}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 0;">
<tr><td align="center">
<table width="680" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.10);">

  <!-- CABEÇALHO -->
  <tr>
    <td style="background:linear-gradient(135deg,#0a1628 80%,#1a2e50);padding:28px 32px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="font-size:20px;font-weight:bold;color:#c9a84c;letter-spacing:1px;">&#9878; SIGNU &middot; Resumo Semanal de Gestão</div>
          <div style="font-size:13px;color:#8fa3c0;margin-top:4px;">${dataExtenso}</div>
        </td>
        <td align="right" style="vertical-align:top;">
          <div style="background:#c9a84c;color:#0a1628;font-weight:bold;font-size:11px;padding:4px 12px;border-radius:20px;">GESTÃO</div>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- PANORAMA GERAL -->
  <tr><td style="padding:24px 32px 8px;">
    <div style="font-size:11px;font-weight:bold;color:#8fa3c0;letter-spacing:2px;margin-bottom:14px;">PANORAMA GERAL &mdash; ${totalGeral} ITENS MONITORADOS</div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${cardsHtml}
    </tr></table>
  </td></tr>

  <!-- DIVISOR -->
  <tr><td style="padding:16px 32px 0;"><div style="height:1px;background:linear-gradient(to right,#c9a84c,#e8d5a0,#f5f5f5);"></div></td></tr>

  <!-- TABELA POR SERVIDOR -->
  <tr><td style="padding:16px 32px 0;">
    <div style="font-size:11px;font-weight:bold;color:#8fa3c0;letter-spacing:2px;margin-bottom:12px;">DISTRIBUIÇÃO POR SERVIDOR</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr style="background:#0a1628;">
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#c9a84c;font-weight:bold;letter-spacing:1px;border-bottom:2px solid #c9a84c;">SERVIDOR</th>
        <th style="padding:10px 8px;text-align:center;font-size:11px;color:#ffffff;font-weight:bold;letter-spacing:1px;border-bottom:2px solid #c9a84c;">TOTAL</th>
        ${thCategorias}
      </tr>
      ${linhasHtml}
      <tr style="background:#0a1628;">
        <td style="padding:12px 14px;font-size:13px;font-weight:bold;color:#c9a84c;border-left:3px solid #c9a84c;">TOTAL GERAL</td>
        <td style="padding:12px 8px;text-align:center;font-size:15px;font-weight:bold;color:#ffffff;">${totalGeral}</td>
        ${celulasTotais}
      </tr>
    </table>
  </td></tr>

  <!-- DIVISOR -->
  <tr><td style="padding:16px 32px 0;"><div style="height:1px;background:linear-gradient(to right,#c9a84c,#e8d5a0,#f5f5f5);"></div></td></tr>

  <!-- TOTAIS POR LISTA -->
  <tr><td style="padding:16px 32px 0;">
    <div style="font-size:11px;font-weight:bold;color:#8fa3c0;letter-spacing:2px;margin-bottom:12px;">ITENS POR LISTA</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr style="background:#0a1628;">
        <th style="padding:9px 14px;text-align:left;font-size:11px;color:#c9a84c;font-weight:bold;letter-spacing:1px;border-bottom:2px solid #c9a84c;">LISTA</th>
        <th style="padding:9px 8px;text-align:center;font-size:11px;color:#ffffff;font-weight:bold;letter-spacing:1px;border-bottom:2px solid #c9a84c;">TOTAL</th>
      </tr>
      ${listasResumoHtml}
      <tr style="background:#0a1628;">
        <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#c9a84c;border-left:3px solid #c9a84c;">TOTAL GERAL</td>
        <td style="padding:10px 8px;text-align:center;font-size:14px;font-weight:bold;color:#ffffff;">${totalGeral}</td>
      </tr>
    </table>
  </td></tr>

  <!-- RODAPÉ -->
  <tr><td style="padding:20px 32px 24px;">
    <div style="background:#f8fafc;border-left:3px solid #c9a84c;border-radius:0 6px 6px 0;padding:10px 14px;font-size:11px;color:#64748b;">
      Gerado automaticamente pelo SIGNU via Google Apps Script &middot; ${formatarDataGestao(hoje)}
    </div>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// ─── UTILITÁRIO ───────────────────────────────────────────────────────────────

function formatarDataGestao(data) {
  return Utilities.formatDate(data, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

/**
 * GATILHO SEMANAL:
 *   Gatilhos → + Adicionar gatilho
 *   Função: enviarRelatorioGestao
 *   Tipo: Temporizador semanal
 *   Dia: Segunda-feira
 *   Hora: 7h00 – 8h00
 *
 * ENCERRAR O POWER AUTOMATE:
 *   1. Acesse flow.microsoft.com com sua conta TJDFT
 *   2. Meus fluxos → NULEJ_Relatorio_Semanal_Teams
 *   3. Clique nos três pontos → "Desativar"
 *   (não precisa excluir — desativar já interrompe os disparos)
 */
