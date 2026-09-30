// lib/filaDoacoes.js
//
// Regras da fila de doações (aba Doacoes_Diligencia) — puro, sem I/O, usado
// tanto pela tela (Gestão) quanto pelo servidor (reorganização após escrita).
//
// A lista se divide em blocos, numerados em sequência (1º, 2º, 3º…):
//   1. CONCLUIDO  — status CONCLUÍDO/CANCELADO, ordem = nº da entidade
//   2. ANDAMENTO  — já tem status ou responsável; entidade TRAVADA; ordem = nº da entidade
//   3. PENDENTE   — status vazio e sem responsável; ordem = DATA_DECISAO. A entidade
//                   é só PREVISTA: recalculada pela posição, então um lote com
//                   decisão mais antiga entra na frente e "puxa" a entidade da vez.
//   (APTIDAO     — "AGUARDANDO APTIDÃO", fica fora da fila)
//
// Fila de entidades: as que nunca tiveram evento (lote travado ou anotação de
// recusa/pulo) vêm primeiro, pela ordem do edital; depois as já atendidas, da
// que teve o último evento há mais tempo p/ a mais recente.

export const BLOCO = {
  CONCLUIDO: "CONCLUIDO",
  ANDAMENTO: "ANDAMENTO",
  PENDENTE:  "PENDENTE",
  APTIDAO:   "APTIDAO",
};

export const BLOCO_META = {
  CONCLUIDO: { label: "Concluído",         color: "#6b7280" },
  ANDAMENTO: { label: "Em andamento",      color: "#2563eb" },
  PENDENTE:  { label: "Aguardando início", color: "#d97706" },
};

const STATUS_ENCERRADOS = ["CONCLUÍDO", "CONCLUIDO", "CANCELADO"];

export function numEntidade(nome) {
  const m = String(nome || "").trim().match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

export function blocoDoacao(item) {
  const status = String(item.STATUS_LOCAL_PA || "").trim().toUpperCase();
  const resp   = String(item.RESPONSAVEL || "").trim();
  if (status === "AGUARDANDO APTIDÃO") return BLOCO.APTIDAO;
  if (STATUS_ENCERRADOS.includes(status)) return BLOCO.CONCLUIDO;
  if (status || resp) return BLOCO.ANDAMENTO;
  return BLOCO.PENDENTE;
}

// Aceita "2025-10-15", "15/10/2025" e "01/01/2024 0:00:00"
export function dataMs(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

const dataDecisao = (i) => dataMs(i.DATA_DECISAO) ?? dataMs(i.DATA_CADASTRO);

// entidades: ["N. Nome", …] na ordem do edital. anotacoes: linhas de Anotacoes_Doacoes.
export function filaEntidades(entidades, doacoes, anotacoes = []) {
  const ultimo = {}; // nº entidade -> ms do último evento
  const marcar = (n, t) => {
    if (n == null) return;
    const v = t ?? 0;
    if (ultimo[n] === undefined || v > ultimo[n]) ultimo[n] = v;
  };
  doacoes.forEach(d => {
    const b = blocoDoacao(d);
    if (b === BLOCO.CONCLUIDO || b === BLOCO.ANDAMENTO) marcar(numEntidade(d.ENTIDADE_NOME), dataDecisao(d));
  });
  anotacoes.forEach(a => marcar(numEntidade(a.ENTIDADE), dataMs(a.DATA)));

  return [...entidades].sort((a, b) => {
    const na = numEntidade(a), nb = numEntidade(b);
    const ea = ultimo[na], eb = ultimo[nb];
    if ((ea === undefined) !== (eb === undefined)) return ea === undefined ? -1 : 1;
    if (ea !== undefined && ea !== eb) return ea - eb;
    return (na ?? 9999) - (nb ?? 9999);
  });
}

// Monta a fila completa. Retorna:
//   itens      — [{ ...item, _bloco, _posicao, _entidadePrevista }] (sem os de aptidão), já ordenados
//   aptidao    — itens AGUARDANDO APTIDÃO
//   loteDaVez  — 1º pendente (ou null)
//   proximaEntidade — entidade que o próximo lote cadastrado vai receber
//   ajustes    — [{ _rowNumber, de, para }] pendentes cuja ENTIDADE_NOME gravada difere da prevista
export function montarFilaDoacoes(doacoes, entidades, anotacoes = []) {
  const porNumEntidade = (a, b) =>
    (numEntidade(a.ENTIDADE_NOME) ?? 9999) - (numEntidade(b.ENTIDADE_NOME) ?? 9999)
    || (dataDecisao(a) ?? 0) - (dataDecisao(b) ?? 0)
    || a._rowNumber - b._rowNumber;
  const porDecisao = (a, b) =>
    (dataDecisao(a) ?? Infinity) - (dataDecisao(b) ?? Infinity) || a._rowNumber - b._rowNumber;

  const grupos = { CONCLUIDO: [], ANDAMENTO: [], PENDENTE: [], APTIDAO: [] };
  doacoes.forEach(d => grupos[blocoDoacao(d)].push(d));
  grupos.CONCLUIDO.sort(porNumEntidade);
  grupos.ANDAMENTO.sort(porNumEntidade);
  grupos.PENDENTE.sort(porDecisao);

  const fila = filaEntidades(entidades, doacoes, anotacoes);
  const ajustes = [];
  const pendentes = grupos.PENDENTE.map((d, i) => {
    const prevista = fila[i] || "";
    const atual = String(d.ENTIDADE_NOME || "").trim();
    if (prevista && numEntidade(atual) !== numEntidade(prevista)) {
      ajustes.push({ _rowNumber: d._rowNumber, de: atual, para: prevista });
    }
    return { ...d, _entidadePrevista: prevista };
  });

  const itens = [
    ...grupos.CONCLUIDO.map(d => ({ ...d, _bloco: BLOCO.CONCLUIDO })),
    ...grupos.ANDAMENTO.map(d => ({ ...d, _bloco: BLOCO.ANDAMENTO })),
    ...pendentes.map(d => ({ ...d, _bloco: BLOCO.PENDENTE })),
  ].map((d, i) => ({ ...d, _posicao: i + 1 }));

  return {
    itens,
    aptidao: grupos.APTIDAO,
    loteDaVez: itens.find(i => i._bloco === BLOCO.PENDENTE) || null,
    proximaEntidade: fila[grupos.PENDENTE.length] || null,
    ajustes,
  };
}
