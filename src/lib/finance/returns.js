/* ═══════════════════════════════════════════════════════════════
   Matemática de retorno de carteira (TIR/XIRR, nota da carteira,
   composição por grupo/tipo, retorno por ativo).
   Portado quase verbatim de dashboardinvestimentos.jsx (linhas 195-352).
   Nenhuma fórmula foi alterada — só viraram exports puros, sem fechar
   sobre estado de componente.
   ═══════════════════════════════════════════════════════════════ */
import { GRUPO, ORDEM_GRUPO, TIPO, ORDEM_TIPO, grupoDe, tipoDe } from "./taxonomy.js";

// month = { assets: [{nome, valor}], fimISO, aportes, proventos }
export const investido = (assetGroupMap, m) =>
  m.assets.filter((a) => grupoDe(assetGroupMap, a.nome) !== "LIQUIDEZ").reduce((s, a) => s + a.valor, 0);
export const caixaDoMes = (assetGroupMap, m) =>
  m.assets.filter((a) => grupoDe(assetGroupMap, a.nome) === "LIQUIDEZ").reduce((s, a) => s + a.valor, 0);
export const totalDoMes = (m) => m.assets.reduce((s, a) => s + a.valor, 0);

export function tir(fluxos) {
  if (fluxos.length < 2) return null;
  const d0 = new Date(fluxos[0].iso);
  const anos = (iso) => (new Date(iso) - d0) / 864e5 / 365;
  const vpl = (r) => fluxos.reduce((s, f) => s + f.valor / Math.pow(1 + r, anos(f.iso)), 0);
  let lo = -0.9999, hi = 20;
  if (vpl(lo) * vpl(hi) > 0) return null;
  for (let i = 0; i < 300; i++) { const m = (lo + hi) / 2; (vpl(m) > 0 ? lo = m : hi = m); }
  return (lo + hi) / 2;
}

/* XIRR convertida para a taxa equivalente ao período exato dos fluxos
   (não anualizada) — é o número certo para "quanto rendeu esse mês". */
export function xirrPeriodoPct(fluxos) {
  const r = tir(fluxos);
  if (r === null) return null;
  const dias = (new Date(fluxos[fluxos.length - 1].iso) - new Date(fluxos[0].iso)) / 864e5;
  return (Math.pow(1 + r, dias / 365) - 1) * 100;
}

export function retornoPeriodo(iniISO, iniVal, apISO, apVal, fimISO, fimVal) {
  const rent = fimVal - iniVal - apVal;
  if (apVal > 0 && apISO) {
    const fluxos = [{ iso: iniISO, valor: -iniVal }, { iso: apISO, valor: -apVal }, { iso: fimISO, valor: fimVal }];
    const p = xirrPeriodoPct(fluxos);
    if (p !== null) return { rent, pct: p, xirr: true };
  }
  return { rent, pct: iniVal ? (rent / iniVal) * 100 : 0, xirr: false };
}

export function retornoMes(assetGroupMap, mAnt, m) {
  if (!mAnt || !m?.aportes) return null;
  const ini = investido(assetGroupMap, mAnt), fim = investido(assetGroupMap, m), ap = m.aportes.total;
  const prov = m.proventos?.total || 0;
  const r = retornoPeriodo(mAnt.fimISO, ini, m.aportes.dataISO, ap, m.fimISO, fim + prov);
  return { ini, fim, aporte: ap, prov, rent: r.rent, pct: r.pct, xirr: r.xirr };
}

/* ── Nota da carteira (legado, investimento-only): pesos 35/25/20/10/10 ── */
export const PESOS = { rentabilidade: 0.35, constancia: 0.25, diversificacao: 0.20, liquidez: 0.10, reserva: 0.10 };
export const clamp10 = (v, min = 0, max = 10) => Math.max(min, Math.min(max, v));

export function notaRentabilidade(mesPct, cdiPct) {
  if (mesPct === null || mesPct === undefined || cdiPct === null || cdiPct === undefined) return null;
  return clamp10(5 + (mesPct - cdiPct) * 2);
}
export function notaConstancia(escopo) {
  if (!escopo.length) return null;
  const comAporte = escopo.filter((m) => m.aportes && m.aportes.total > 0).length;
  return clamp10((comAporte / escopo.length) * 10);
}
export function notaDiversificacao(tiposArr) {
  const risco = tiposArr.filter((t) => t.tipo !== "RENDA_FIXA" && t.tipo !== "CAIXA");
  const totalRisco = risco.reduce((s, t) => s + t.valor, 0);
  if (!totalRisco) return null;
  const hhi = risco.reduce((s, t) => s + Math.pow(t.valor / totalRisco, 2), 0);
  return clamp10((1 - hhi) * 13);
}
export function notaLiquidez(pctCaixa) {
  if (pctCaixa === null || pctCaixa === undefined) return null;
  if (pctCaixa >= 8 && pctCaixa <= 20) return 10;
  if (pctCaixa < 8) return clamp10((pctCaixa / 8) * 10);
  return clamp10(10 - (pctCaixa - 20) * 0.3);
}
export function notaReserva(pctReserva) {
  if (pctReserva === null || pctReserva === undefined) return null;
  if (pctReserva >= 30 && pctReserva <= 55) return 10;
  if (pctReserva < 30) return clamp10((pctReserva / 30) * 10);
  return clamp10(10 - (pctReserva - 55) * 0.25, 3);
}

export function gruposDoMes(assetGroupMap, month) {
  if (!month) return [];
  const inv = investido(assetGroupMap, month), acc = {};
  month.assets.forEach((a) => { const g = grupoDe(assetGroupMap, a.nome); if (g !== "LIQUIDEZ") acc[g] = (acc[g] || 0) + a.valor; });
  return ORDEM_GRUPO.filter((g) => acc[g] !== undefined)
    .map((g) => ({ grupo: g, ...GRUPO[g], valor: acc[g], pct: inv ? (acc[g] / inv) * 100 : 0 }));
}

export function tiposDoMes(assetTipoMap, month) {
  if (!month) return [];
  const tot = totalDoMes(month), acc = {};
  month.assets.forEach((a) => { const t = tipoDe(assetTipoMap, a.nome); acc[t] = (acc[t] || 0) + a.valor; });
  return ORDEM_TIPO.filter((t) => acc[t] !== undefined)
    .map((t) => ({ tipo: t, ...TIPO[t], valor: acc[t], pct: tot ? (acc[t] / tot) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

export function retornosPorAtivo(assetGroupMap, prev, latest) {
  if (!latest || !prev) return [];
  const antes = {}; prev.assets.forEach((a) => (antes[a.nome] = a.valor));
  const ap = latest.aportes?.ativoBreakdown || {};
  const apISO = latest.aportes?.dataISO;
  const provMap = {}; (latest.proventos?.itens || []).forEach((x) => (provMap[x.t] = x.v));
  return latest.assets.filter((a) => a.valor > 0).map((a) => {
    const b = antes[a.nome];
    const apv = ap[a.nome]?.valor || 0;
    const prov = provMap[a.nome] || 0;
    const ok = b !== undefined && b > 0;
    if (!ok) return { nome: a.nome, grupo: grupoDe(assetGroupMap, a.nome), valor: a.valor, aporte: apv, rendVal: null, rendPct: null, xirr: false };
    const r = retornoPeriodo(prev.fimISO, b, apISO, apv, latest.fimISO, a.valor + prov);
    return { nome: a.nome, grupo: grupoDe(assetGroupMap, a.nome), valor: a.valor, aporte: apv, rendVal: r.rent, rendPct: r.pct, xirr: r.xirr };
  }).sort((x, y) => y.valor - x.valor);
}
