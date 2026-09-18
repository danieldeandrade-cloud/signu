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

// E-mails pessoais de login autorizados (ver auth.js, lista PERMITIDOS) → nome.
// Necessário porque o login é feito com e-mail pessoal (Gmail/iCloud), não o
// institucional @tjdft.jus.br usado em SERVIDORES_EMAIL pra outra finalidade
// (endereço de envio do relatório por e-mail).
const NOME_POR_EMAIL_PESSOAL = {
  "carcae@gmail.com":                    "Carlos Caetano",
  "amandalobojunqueira@gmail.com":       "Amanda Junqueira",
  "bsboqfazer@gmail.com":                "Letícia Mota",
  "carlaearaujo2@gmail.com":             "Carla Araújo",
  "marcelodefreitasoliveira@gmail.com":  "Marcelo Oliveira",
  "joloara@gmail.com":                   "Loara Passo",
  "cacausantos@gmail.com":               "Cláudia Santos",
  "danieldeandrade@icloud.com":          "Daniel de Andrade",
  "danieldeandrade.pessoal@gmail.com":   "Daniel de Andrade",
  "carlosalex1318@gmail.com":            "Carlos Alexandre Amorim",
};

// Resolve o nome de exibição de quem está logado, a partir do e-mail da
// sessão (NextAuth) — usado pra carimbar autoria (MODIFICADO_POR, histórico
// de alterações). Cobre tanto login institucional (@tjdft.jus.br, mapeado
// via SERVIDORES_EMAIL) quanto os e-mails pessoais de teste autorizados.
export function getNomePorEmail(email) {
  const alvo = (email || "").trim().toLowerCase();
  if (!alvo) return "";
  if (NOME_POR_EMAIL_PESSOAL[alvo]) return NOME_POR_EMAIL_PESSOAL[alvo];
  const porInstitucional = Object.entries(SERVIDORES_EMAIL)
    .find(([, em]) => em.toLowerCase() === alvo);
  if (porInstitucional) return porInstitucional[0];
  return email || "";
}
