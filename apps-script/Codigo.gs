/**
 * SIGNU — Dashboard de Produtividade e Gestão
 *
 * Script vinculado à planilha SIGNU_DB. Lê a aba Historico_Alteracoes (log
 * de quem editou/criou/promoveu cada item, gravado pelo app desde
 * 2026-09-18) + as abas de bens, e monta/atualiza a aba
 * "Dashboard_Produtividade" com:
 *   - Produtividade por servidor (últimos 7 e 30 dias, por tipo de ação)
 *   - Retrato da fila atual por lista e status
 *
 * Instalação (uma vez): na planilha SIGNU_DB, Extensões > Apps Script,
 * apague o conteúdo padrão, cole este arquivo inteiro, salve (ícone de
 * disquete). Volte pra planilha e recarregue a página — aparece o menu
 * "📊 Relatórios SIGNU" na barra de menus.
 */

const ABAS_BENS = [
  'Bens_CEGOC', 'Bens_DPJ_GC99', 'Bens_PCDF_1HIGEIA', 'Bens_PCDF_2HIGEIA',
  'Doacoes_Diligencia', 'CaixaEntrada_SEI',
];
const ABA_HISTORICO = 'Historico_Alteracoes';
const ABA_DASHBOARD = 'Dashboard_Produtividade';
const ACOES_PRODUTIVAS = ['CRIADO', 'EDITADO', 'TRANSICAO', 'PROMOVIDO', 'TEP_REGISTRADO', 'CONCLUIDO_SEI'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 Relatórios SIGNU')
    .addItem('Atualizar dashboard agora', 'gerarDashboard')
    .addSeparator()
    .addItem('Ativar atualização automática (seg. 7h)', 'ativarGatilhoSemanal')
    .addItem('Desativar atualização automática', 'desativarGatilhoSemanal')
    .addToUi();
}

function gerarDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(ABA_DASHBOARD) || ss.insertSheet(ABA_DASHBOARD);
  aba.clear();
  aba.clearFormats();

  const historico = lerAba(ss, ABA_HISTORICO);
  const agora = new Date();
  const dias7 = new Date(agora.getTime() - 7 * 24 * 3600 * 1000);
  const dias30 = new Date(agora.getTime() - 30 * 24 * 3600 * 1000);

  const produtividade = calcularProdutividade(historico, dias7, dias30);
  const backlog = calcularBacklog(ss);

  let linha = 1;
  aba.getRange(linha, 1).setValue('Dashboard de Produtividade e Gestão — SIGNU/NULEJ')
    .setFontWeight('bold').setFontSize(14);
  linha++;
  aba.getRange(linha, 1).setValue(
    'Atualizado em ' + Utilities.formatDate(agora, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
  ).setFontColor('#6b7280');
  linha += 2;

  // --- Produtividade por servidor ---
  aba.getRange(linha, 1).setValue('Produtividade por servidor').setFontWeight('bold').setFontSize(12);
  linha++;
  if (historico.length === 0) {
    aba.getRange(linha, 1).setValue(
      'Ainda sem dados — o histórico começou a ser gravado em 2026-09-18, só mostra a partir daí.'
    ).setFontColor('#9ca3af').setFontStyle('italic');
    linha += 2;
  } else {
    const headerProd = ['Servidor', 'Últimos 7 dias', 'Últimos 30 dias', 'Total no histórico']
      .concat(ACOES_PRODUTIVAS.map(a => a + ' (30d)'));
    aba.getRange(linha, 1, 1, headerProd.length).setValues([headerProd])
      .setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    linha++;
    const inicioTabelaProd = linha;
    const servidores = Object.keys(produtividade).sort(
      (a, b) => produtividade[b].total30 - produtividade[a].total30
    );
    servidores.forEach(nome => {
      const p = produtividade[nome];
      const linhaValores = [nome, p.total7, p.total30, p.totalGeral]
        .concat(ACOES_PRODUTIVAS.map(a => p.porAcao30[a] || 0));
      aba.getRange(linha, 1, 1, linhaValores.length).setValues([linhaValores]);
      linha++;
    });
    if (servidores.length > 0) {
      aba.getRange(inicioTabelaProd, 2, servidores.length, 3).setBackground('#f3f4f6');
    }
    linha += 2;
  }

  // --- Fila atual por lista e status ---
  aba.getRange(linha, 1).setValue('Fila atual por lista e status').setFontWeight('bold').setFontSize(12);
  linha++;
  const headerBacklog = ['Lista', 'Status', 'Quantidade'];
  aba.getRange(linha, 1, 1, headerBacklog.length).setValues([headerBacklog])
    .setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
  linha++;
  backlog.forEach(l => {
    aba.getRange(linha, 1, 1, 3).setValues([[l.lista, l.status, l.quantidade]]);
    linha++;
  });

  aba.autoResizeColumns(1, 10);
  aba.setFrozenRows(1);

  SpreadsheetApp.getActiveSpreadsheet().toast('Dashboard atualizado com sucesso.', 'SIGNU', 5);
}

function lerAba(ss, nome) {
  const aba = ss.getSheetByName(nome);
  if (!aba) return [];
  const valores = aba.getDataRange().getValues();
  if (valores.length < 2) return [];
  const cabecalho = valores[0];
  return valores.slice(1).map(linha => {
    const obj = {};
    cabecalho.forEach((c, i) => { obj[c] = linha[i]; });
    return obj;
  });
}

function calcularProdutividade(historico, dias7, dias30) {
  const porServidor = {};
  historico.forEach(h => {
    const autor = String(h.AUTOR || '').trim();
    if (!autor) return;
    const acao = String(h.ACAO || '').trim();
    const ts = h.TIMESTAMP instanceof Date ? h.TIMESTAMP : new Date(h.TIMESTAMP);
    if (isNaN(ts.getTime())) return;

    if (!porServidor[autor]) {
      porServidor[autor] = { total7: 0, total30: 0, totalGeral: 0, porAcao30: {} };
    }
    const p = porServidor[autor];
    p.totalGeral++;
    if (ts >= dias30) {
      p.total30++;
      p.porAcao30[acao] = (p.porAcao30[acao] || 0) + 1;
      if (ts >= dias7) p.total7++;
    }
  });
  return porServidor;
}

function calcularBacklog(ss) {
  const linhas = [];
  ABAS_BENS.forEach(nomeAba => {
    const dados = lerAba(ss, nomeAba);
    const contagem = {};
    dados.forEach(item => {
      const status = String(item.STATUS_DILIGENCIA || item.STATUS_LOCAL_PA || item.ACAO || 'SEM STATUS').trim()
        || 'SEM STATUS';
      contagem[status] = (contagem[status] || 0) + 1;
    });
    Object.keys(contagem).sort().forEach(status => {
      linhas.push({ lista: nomeAba, status, quantidade: contagem[status] });
    });
  });
  return linhas;
}

function ativarGatilhoSemanal() {
  desativarGatilhoSemanal();
  ScriptApp.newTrigger('gerarDashboard')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(7)
    .create();
  SpreadsheetApp.getActiveSpreadsheet().toast('Atualização automática ativada (toda segunda às 7h).', 'SIGNU', 5);
}

function desativarGatilhoSemanal() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'gerarDashboard') ScriptApp.deleteTrigger(t);
  });
  SpreadsheetApp.getActiveSpreadsheet().toast('Atualização automática desativada.', 'SIGNU', 5);
}
