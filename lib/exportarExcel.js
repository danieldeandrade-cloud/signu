// lib/exportarExcel.js
// Exportação para .xlsx com estilo SIGNU (cabeçalho navy + borda dourada + zebra).
// Usa exceljs (servidor/cliente) via dynamic import para evitar bundle no SSR.

const COR_HEADER_BG  = 'FF0A1628'; // navy
const COR_HEADER_FG  = 'FFFFFFFF'; // branco
const COR_BORDA_OURO = 'FFC9A84C'; // dourado
const COR_ZEBRA      = 'FFF5F5F8'; // cinza claro
const COR_TEXTO      = 'FF111827'; // quase preto

// Larguras padrão por nome de coluna (em caracteres)
const LARGURAS = {
  ID:                  14,
  ID_PASEI:            32,
  ID_LEGADO:           14,
  TIPO_BEM:            14,
  NIV:                 22,
  STATUS_DILIGENCIA:   22,
  DESTINACAO:          20,
  RESPONSAVEL:         22,
  RESPONSAVEL_EMAIL:   30,
  FIB:                  8,
  CEB_TEP_TIV:          8,
  OFICIO_BAIXA:         8,
  RESTRICAO_ROUBO:      8,
  PESO_KG:             10,
  OBSERVACOES:         45,
  DATA_CADASTRO:       16,
  DATA_ATUALIZACAO:    18,
  MODIFICADO_POR:      20,
  ULTIMA_ANALISE:      20,
  LOTE:                12,
  PA_PJE:              28,
  DATA_ENTRADA:        16,
  PRAZO_6MESES:        16,
  MOTIVO_SAIDA:        20,
  DATA_SAIDA:          14,
  DEPOSITO:            18,
  PA_TJDFT:            20,
  ORIGEM_CEGOC_ID:     16,
  ACAO:                16,
  ENTIDADE_ID:         16,
  ENTIDADE_NOME:       28,
  STATUS_LOCAL_PA:     20,
  LISTA_ORIGEM:        16,
  DATA_RETIRADA:       16,
};

function largura(col) {
  return LARGURAS[col] ?? Math.min(Math.max(col.length + 4, 12), 40);
}

async function criarWorkbook() {
  const ExcelJS = (await import('exceljs')).default ?? (await import('exceljs'));
  return new ExcelJS.Workbook();
}

function preencherAba(sheet, dados, nomeAba) {
  if (!dados.length) {
    sheet.addRow(['(sem dados)']);
    return;
  }

  const colunas = Object.keys(dados[0]).filter(k => k !== '_rowNumber');

  // Cabeçalho
  sheet.columns = colunas.map(col => ({
    header: col,
    key:    col,
    width:  largura(col),
  }));

  // Estilo do cabeçalho
  const headerRow = sheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.font      = { name: 'Arial', bold: true, color: { argb: COR_HEADER_FG }, size: 10 };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_HEADER_BG } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border    = {
      bottom: { style: 'medium', color: { argb: COR_BORDA_OURO } },
    };
  });
  headerRow.height = 20;

  // Auto-filter + freeze
  sheet.autoFilter = { from: 'A1', to: { row: 1, column: colunas.length } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Linhas de dados
  dados.forEach((item, idx) => {
    const valores = colunas.map(col => item[col] ?? '');
    const row = sheet.addRow(valores);
    const zebra = idx % 2 === 1;

    row.eachCell({ includeEmpty: true }, cell => {
      cell.font      = { name: 'Arial', size: 10, color: { argb: COR_TEXTO } };
      cell.alignment = { vertical: 'middle', wrapText: false };
      if (zebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_ZEBRA } };
      }
    });
    row.height = 16;
  });
}

function dataHoje() {
  return new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
}

function baixarBlob(buffer, nomeArquivo) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

/** Exporta um único array de itens como uma aba */
export async function exportarListaParaExcel(dados, nomeAba) {
  const wb    = await criarWorkbook();
  const sheet = wb.addWorksheet(nomeAba);
  preencherAba(sheet, dados, nomeAba);
  const buffer = await wb.xlsx.writeBuffer();
  baixarBlob(buffer, `SIGNU_${nomeAba}_${dataHoje()}.xlsx`);
}

/** Exporta um objeto { nomAba: [...] } com uma aba por lista */
export async function exportarTodasAsListasParaExcel(todasAsListas) {
  const wb = await criarWorkbook();
  for (const [nome, dados] of Object.entries(todasAsListas)) {
    const sheet = wb.addWorksheet(nome);
    preencherAba(sheet, dados, nome);
  }
  const buffer = await wb.xlsx.writeBuffer();
  baixarBlob(buffer, `SIGNU_Exportacao_Completa_${dataHoje()}.xlsx`);
}
