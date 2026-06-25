// lib/servidores.js
// Mapeamento de servidores do NULEJ: nome no sistema → e-mail institucional

export const SERVIDORES_EMAIL = {
  "Amanda Junqueira":  "amanda.junqueira@tjdft.jus.br",
  "Carla Araújo":      "carla.araujo@tjdft.jus.br",
  "Carlos Caetano":    "carlos.caetano@tjdft.jus.br",
  "Cláudia Santos":    "claudia.santos@tjdft.jus.br",
  "Loara Passo":       "joyanna.passo@tjdft.jus.br",
  "Letícia Mota":      "leticia.mota@tjdft.jus.br",
  "Marcelo Oliveira":  "marcelo.oliveira@tjdft.jus.br",
};

// Gestores recebem resumo completo (todos os bens de todas as listas)
export const GESTORES_EMAIL = [
  "daniel.andrade@tjdft.jus.br",
  "carlos.amorim@tjdft.jus.br",
];

// Extrai o nome do responsável de um registro (normalizado)
export function getNomeResponsavel(item) {
  return (
    item.RESPONSAVEL ||
    item.Responsavel ||
    item.responsavel ||
    item.ATRIBUIDO_A ||
    ""
  ).trim();
}
