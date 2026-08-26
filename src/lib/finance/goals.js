/* ═══════════════════════════════════════════════════════════════
   Metas e alocação-alvo — matemática de anuidade (PMT).
   Portado verbatim de dashboardinvestimentos.jsx (linhas 1046-1101).
   As funções load*/save* que usavam window.storage NÃO foram portadas
   aqui — viram queries Supabase em src/data/goals.js (Fase 5).
   ═══════════════════════════════════════════════════════════════ */
export const PRIORIDADES_META = [
  { key: "alta", label: "Alta", cor: "#8E2721" },
  { key: "media", label: "Média", cor: "#755810" },
  { key: "baixa", label: "Baixa", cor: "#525C4E" },
];

/* Aporte mensal necessário pra atingir um valor-alvo num prazo, dada
   uma taxa. Fórmula PMT de anuidade. */
export function aporteNecessario(valorAtual, valorAlvo, meses, taxaMensalDec) {
  if (meses <= 0) return null;
  if (valorAtual >= valorAlvo) return 0;
  if (taxaMensalDec === 0) return (valorAlvo - valorAtual) / meses;
  const fator = Math.pow(1 + taxaMensalDec, meses);
  return (valorAlvo - valorAtual * fator) * taxaMensalDec / (fator - 1);
}

/* Em quantos meses o alvo é atingido, dado o aporte atual. */
export function mesesParaAlvo(valorAtual, valorAlvo, aporteMensal, taxaMensalDec) {
  if (valorAtual >= valorAlvo) return 0;
  if (aporteMensal <= 0 && taxaMensalDec <= 0) return null;
  if (taxaMensalDec === 0) return aporteMensal > 0 ? (valorAlvo - valorAtual) / aporteMensal : null;
  const numerador = valorAlvo * taxaMensalDec + aporteMensal;
  const den = valorAtual * taxaMensalDec + aporteMensal;
  if (den <= 0 || numerador / den <= 0) return null;
  const n = Math.log(numerador / den) / Math.log(1 + taxaMensalDec);
  return isFinite(n) && n > 0 ? n : null;
}

export function addMesesISO(isoBase, meses) {
  const d = new Date(isoBase);
  d.setMonth(d.getMonth() + Math.round(meses));
  return d.toISOString().slice(0, 10);
}
