// lib/observacoes.js
// Histórico do campo OBSERVACOES: entradas no formato "[ts | autor] texto".
// Sempre devolve a lista ordenada com a MAIS RECENTE primeiro.

export function tsToMs(ts) {
  const s = String(ts || "").trim();
  // DD/MM/YYYY[ ,]HH:MM[:SS]
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  return NaN;
}

export function parseNotas(obsStr) {
  const raw = (obsStr || "").trim();
  if (!raw) return [];
  const regex = /\[([^\]]+)\]([\s\S]*?)(?=\[[^\]]+\]|$)/g;
  const entries = [];
  let m, i = 0;
  while ((m = regex.exec(raw)) !== null) {
    const texto = m[2].trim();
    if (!texto) continue;
    const partes = m[1].split("|");
    entries.push({
      ts: partes[0]?.trim() || m[1].trim(),
      autor: partes[1]?.trim() || "",
      texto,
      _i: i++,
      _t: tsToMs(m[1]),
    });
  }
  // Sem marcação [ ] → entrada única
  if (entries.length === 0) return [{ ts: "", autor: "", texto: raw, _i: 0, _t: NaN }];

  entries.sort((a, b) => {
    const ha = !isNaN(a._t), hb = !isNaN(b._t);
    if (ha && hb) return b._t - a._t || a._i - b._i;   // mais recente primeiro
    if (ha !== hb) return ha ? -1 : 1;                  // datadas antes das sem data
    return a._i - b._i;                                 // sem data: ordem do texto
  });
  return entries;
}

// Texto da observação mais recente (com truncagem opcional)
export function ultimaObs(obsStr, max = 0) {
  const n = parseNotas(obsStr);
  if (!n.length) return "";
  const t = n[0].texto.replace(/\s+/g, " ").trim();
  return max && t.length > max ? t.slice(0, max - 1) + "…" : t;
}
