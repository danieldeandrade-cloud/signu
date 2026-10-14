// lib/statusReciclagem.js
//
// Regra do NULEJ (Daniel, 2026-10-14): veículo de RECICLAGEM em diligência
// está sempre "EM DILIGÊNCIA HIGEIA" — nunca o "EM DILIGÊNCIA" genérico. Vale
// p/ CEGOC (destinação RECICLAGEM) e PCDF 1ª/2ª (sempre reciclagem). Aplicada
// no ponto único de gravação (lib/googleSheets addRow/updateRow), então cobre
// cadastro, edição, Minha Fila, Importação SEI e transições.
// Histórico: 613 itens corrigidos à mão em 08/10 e mais 6 em 14/10.

const ABAS_VEICULO = { Bens_CEGOC: false, Bens_PCDF_1HIGEIA: true, Bens_PCDF_2HIGEIA: true }; // aba → sempre reciclagem?
const LISTAS_VEICULO = { cegoc: 'Bens_CEGOC', pcdf1: 'Bens_PCDF_1HIGEIA', pcdf2: 'Bens_PCDF_2HIGEIA' };

const norm = (v) => String(v ?? '').toUpperCase().trim();

// dados = campos a gravar; atual = estado atual do item (numa edição) ou {}.
// Devolve o STATUS_DILIGENCIA corrigido, ou null se não há o que trocar.
export function statusHigeiaPara(sheetOuLista, dados, atual = {}) {
  const aba = LISTAS_VEICULO[sheetOuLista] || sheetOuLista;
  if (!(aba in ABAS_VEICULO)) return null;
  const destinacao = norm(dados.DESTINACAO !== undefined ? dados.DESTINACAO : atual.DESTINACAO);
  const reciclagem = ABAS_VEICULO[aba] || destinacao === 'RECICLAGEM';
  const status = norm(dados.STATUS_DILIGENCIA !== undefined ? dados.STATUS_DILIGENCIA : atual.STATUS_DILIGENCIA);
  return reciclagem && status === 'EM DILIGÊNCIA' ? 'EM DILIGÊNCIA HIGEIA' : null;
}
