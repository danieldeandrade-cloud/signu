"use client";
// lib/useEntidades.js
//
// Hook que carrega a lista de entidades credenciadas da aba
// Entidades_Credenciadas (via /api/entidades), no formato "N. Nome"
// — o mesmo usado nos <select> e gravado nas abas de doações.
//
// Se a API falhar, cai no fallback estático (Edital de Chamamento nº 2/2024).

import { useState, useEffect } from "react";

export const ENTIDADES_FALLBACK = [
  "1. Associação Casa de Proteção Magnólia - CPM",
  "2. Projeto Integral de Vida - Pró-Vida",
  "3. ASCOM - Associação Comunitária de São Sebastião - DF",
  "4. Associação Capoeiristas do Rei",
  "5. Instituto de Desenvolvimento da Educação e Implementação de Ações Sociais - IDEIAS Ser Escola",
  "6. Associação de Pais e Amigos dos Excepcionais do DF - APAE/DF",
  "7. Associação Brasília Inclusiva e Direitos Sociais - ABIDS",
  "8. Associação Beneficente Luz do Dia - ABLD",
  "9. Associação Evangelística Palavra de Bênção",
  "10. Instituto Jovens Promessas",
  "11. Instituto Horizontes de Responsabilidade Social - IHRS",
  "12. Creche Criança Cidadã de Planaltina",
  "13. Movimento Popular do Arapoanga pela Cidadania - MPA",
  "14. Centro Esportivo Cultural de Planaltina - DF",
  "15. Instituto de Integração e Formação do Ser Social",
  "16. Movimento de Assistência aos Carentes da Metropolitana",
  "17. Grupo Força para Vencer",
  "18. Associação Evangélica Missão Resgate",
  "19. Academia Gamense de Letras - AGL",
  "20. Organização Viva Vida - OVV",
  "21. Instituto Abba Pai",
  "22. Organização Assistencial Amor sem Fronteira",
  "23. Organização Social Ambiental da Fauna e Flora do Brasil",
  "24. Associação de Moradores dos Bairros Santa Luiza e Cidade Nova",
  "25. Comunidade Terapêutica Elshadai",
  "26. Associação de Moradores Aguaslindense - AMAG",
  "27. Centro de Assistência Social e Espiritual",
  "28. Instituto Esporte e Vida",
  "29. Instituto Epuranios",
  "30. Centro de Integração à Cultura, Esporte e Habitação de Planaltina",
  "31. Aconchego - Grupo de Apoio à Convivência Familiar e Comunitária",
  "32. Obras Sociais do Centro Espírita Fraternidade Jerônimo Candinho",
  "33. Instituto Arkrealiza",
  "34. Instituto Lar dos Velhinhos Maria Madalena",
  "35. Comunidade Cristã Amada",
  "36. Instituto Abraço Solidário",
  "37. Instituto Magia dos Sonhos",
  "38. VESP - Vila Esperança",
  "39. Associação dos Idosos da Ceilândia",
  "40. Associação das Artes dos Manualistas e dos Artesãos - ASSOCIAAMA",
  "41. Casa de Ismael - Lar da Criança",
  "42. Associação Comunitária Missão Shekinah - AMAS",
  "43. Associação Lar Infantil Chico Xavier",
  "44. Lar de São José",
  "45. Instituto Nossa Missão",
  "46. Associação Benéfica Cristã Promotora do Desenvolvimento Integral - ABC PRODEIN",
  "47. Obra das Filhas do Amor de Jesus Cristo (Casa do Menino Jesus)",
  "48. Obras Sociais do Centro Espírita Batuíra",
  "49. Instituto Carisma",
];

export function useEntidades() {
  const [entidades, setEntidades] = useState(ENTIDADES_FALLBACK);

  useEffect(() => {
    let vivo = true;
    fetch("/api/entidades")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(j => {
        if (!vivo) return;
        const lista = (j?.dados || [])
          .filter(e => e.ENTIDADE)
          .sort((a, b) => (Number(a.ID) || 0) - (Number(b.ID) || 0))
          .map(e => `${e.ID}. ${e.ENTIDADE}`);
        if (lista.length) setEntidades(lista);
      })
      .catch(() => { /* mantém o fallback */ });
    return () => { vivo = false; };
  }, []);

  return entidades;
}
