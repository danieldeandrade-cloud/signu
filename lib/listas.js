// lib/listas.js
//
// Mapeia o nome usado nas rotas da API (curto, amigável) para o nome
// real da aba na planilha SIGNU_DB.

export const LISTAS = {
  cegoc: 'Bens_CEGOC',
  dpj: 'Bens_DPJ_GC99',
  pcdf1: 'Bens_PCDF_1HIGEIA',
  pcdf2: 'Bens_PCDF_2HIGEIA',
  sei: 'CaixaEntrada_SEI',
  doacoes_diligencia: 'Doacoes_Diligencia',
  doacoes_realizadas: 'Doacoes_Realizadas',
  retirados: 'Bens_Retirados',
  entidades: 'Entidades_Credenciadas',
  // Anotações de doações não realizadas — motivos de recusa por entidade
  anotacoes_doacoes: 'Anotacoes_Doacoes',
};

export function resolveSheetName(listaParam) {
  const nomeReal = LISTAS[listaParam];
  if (!nomeReal) {
    throw new Error(
      `Lista "${listaParam}" não reconhecida. Listas válidas: ${Object.keys(LISTAS).join(', ')}`
    );
  }
  return nomeReal;
}
