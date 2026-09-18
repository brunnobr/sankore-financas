/* ════════════════════════════════════════════════════════════════
   Financial Score (9 critérios, com repesagem automática quando falta
   dado) + Insight Engine (10 regras). Portado quase verbatim de
   dashboardinvestimentos.jsx — reaproveita notaRentabilidade/
   notaConstancia/notaDiversificacao/notaLiquidez/clamp10 que já
   existem em returns.js (mesma fórmula, sem duplicar). Os critérios
   que dependem de dado que essa fase do app ainda não tem (cartão)
   ficam null e saem do denominador do score, nunca penalizam.
   ═══════════════════════════════════════════════════════════════ */
import {
  clamp10, notaRentabilidade, notaConstancia, notaDiversificacao, notaLiquidez,
  totalDoMes, caixaDoMes, tiposDoMes, gruposDoMes, retornoMes,
} from "./returns.js";
import { agregarTx, categoriasDespesa } from "./categorization.js";

export const PESOS_SCORE = {
  rentabilidade: 0.15, constancia: 0.10, diversificacao: 0.10, liquidez: 0.05, reserva: 0.10,
  fluxoCaixa: 0.15, controleGastos: 0.10, exposicaoCartao: 0.15, crescimentoPatrimonial: 0.10,
}; // soma = 1.00

export const PERFIL_INVESTIDOR = {
  objetivo: "aposentadoria_longo_prazo",
  toleranciaRisco: "moderado",
  mesesReservaAlvo: 3,
};

function notaReservaPersonalizada(reservaAtual, reservaAlvo) {
  if (!reservaAlvo || reservaAtual == null) return null;
  const razao = reservaAtual / reservaAlvo;
  if (razao >= 1 && razao <= 1.5) return 10;
  if (razao < 1) return clamp10(razao * 10);
  return clamp10(10 - (razao - 1.5) * 4);
}
function notaFluxoCaixa(sobraPct) {
  if (sobraPct === null || sobraPct === undefined) return null;
  if (sobraPct >= 5 && sobraPct <= 35) return 10;
  if (sobraPct < 5) return clamp10(5 + sobraPct);
  return clamp10(10 - (sobraPct - 35) * 0.12);
}
function notaControleGastos(despesaAtual, despesaAnterior) {
  if (!despesaAnterior) return null;
  const variacaoPct = ((despesaAtual - despesaAnterior) / despesaAnterior) * 100;
  if (variacaoPct <= 0) return 10;
  return clamp10(10 - variacaoPct * 0.3);
}
function notaExposicaoCartao(parceladoFuturo, receitaMensal) {
  if (parceladoFuturo === null || parceladoFuturo === undefined || !receitaMensal) return null;
  const multiplo = parceladoFuturo / receitaMensal;
  if (multiplo <= 0.5) return 10;
  if (multiplo >= 1.5) return 0;
  return clamp10(10 - (multiplo - 0.5) * 10);
}
function notaCrescimentoPatrimonial(monthsEscopo) {
  if (!monthsEscopo || monthsEscopo.length < 2) return null;
  const serie = monthsEscopo.map((m) => totalDoMes(m));
  const variacoes = [];
  for (let i = 1; i < serie.length; i++) if (serie[i - 1] > 0) variacoes.push((serie[i] - serie[i - 1]) / serie[i - 1] * 100);
  if (!variacoes.length) return null;
  const media = variacoes.reduce((s, v) => s + v, 0) / variacoes.length;
  return clamp10(5 + media * 2);
}
function despesaMediaHistorica(monthsEscopo, transacoesTodas, categoriasMap) {
  const janela = (monthsEscopo || []).slice(-6);
  const valores = janela.map((m) => agregarTx(transacoesTodas.filter((t) => t.data.slice(0, 7) === m.key.slice(0, 7)), categoriasMap).despesa);
  if (!valores.length) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

export function calcularFinancialScore(ctx) {
  const criterios = [
    { chave: "rentabilidade", label: "Rentabilidade", peso: PESOS_SCORE.rentabilidade, nota: notaRentabilidade(ctx.mesPct, ctx.cdiPct) },
    { chave: "constancia", label: "Constância dos aportes", peso: PESOS_SCORE.constancia, nota: notaConstancia(ctx.months || []) },
    { chave: "diversificacao", label: "Diversificação", peso: PESOS_SCORE.diversificacao, nota: notaDiversificacao(ctx.tiposArr || []) },
    { chave: "liquidez", label: "Liquidez", peso: PESOS_SCORE.liquidez, nota: notaLiquidez(ctx.pctCaixa) },
    { chave: "reserva", label: "Reserva", peso: PESOS_SCORE.reserva, nota: notaReservaPersonalizada(ctx.reservaAtual, ctx.reservaAlvo) },
    { chave: "fluxoCaixa", label: "Fluxo de caixa", peso: PESOS_SCORE.fluxoCaixa, nota: notaFluxoCaixa(ctx.sobraPct) },
    { chave: "controleGastos", label: "Controle de gastos", peso: PESOS_SCORE.controleGastos, nota: notaControleGastos(ctx.despesaAtual, ctx.despesaAnterior) },
    { chave: "exposicaoCartao", label: "Exposição em cartão", peso: PESOS_SCORE.exposicaoCartao, nota: notaExposicaoCartao(ctx.parceladoFuturo, ctx.receitaMensal) },
    { chave: "crescimentoPatrimonial", label: "Crescimento patrimonial", peso: PESOS_SCORE.crescimentoPatrimonial, nota: notaCrescimentoPatrimonial(ctx.months) },
  ].map((c) => ({ ...c, contrib: c.nota === null ? 0 : c.nota * c.peso }));

  const notaFinal = criterios.reduce((s, c) => s + c.contrib, 0);
  const pesoValido = criterios.reduce((s, c) => s + (c.nota === null ? 0 : c.peso), 0);
  const notaFinalAjustada = pesoValido ? notaFinal / pesoValido : null;
  const acima = criterios.filter((c) => c.nota !== null && c.nota > 6).sort((a, b) => b.nota - a.nota);
  const abaixo = criterios.filter((c) => c.nota !== null && c.nota < 5).sort((a, b) => a.nota - b.nota);

  return { criterios, notaFinal: notaFinalAjustada, acima, abaixo };
}

/* Reúne tudo que o score e os insights precisam num único lugar — evita
   recalcular a mesma coisa duas vezes. limitesCartao ainda não existe
   nessa fase do app (tela Cartão é placeholder), então parceladoFuturo
   fica sempre null e o critério de exposição em cartão é repesado como
   ausente, sem penalizar. */
export function montarContextoMes({ months, idxMes, assetGroupMap, assetTipoMap, categoriasMap, transacoesDoMes, transacoesMesAnterior, transacoesTodas }) {
  const latest = months[idxMes], prev = idxMes > 0 ? months[idxMes - 1] : null;
  const escopoMeses = months.slice(0, idxMes + 1);
  const mes = retornoMes(assetGroupMap, prev, latest);
  const ag = agregarTx(transacoesDoMes || [], categoriasMap);
  const agAnt = transacoesMesAnterior ? agregarTx(transacoesMesAnterior, categoriasMap) : null;
  const despesasCat = categoriasDespesa(ag, categoriasMap);
  const despesasCatAnt = agAnt ? categoriasDespesa(agAnt, categoriasMap) : null;
  const invTot = totalDoMes(latest);
  const pctCaixa = invTot ? (caixaDoMes(assetGroupMap, latest) / invTot) * 100 : null;
  const grupos = gruposDoMes(assetGroupMap, latest);
  const res = grupos.find((g) => g.grupo === "RESERVA");
  const reservaAtual = res ? res.valor : 0;
  const despesaMedia = transacoesTodas ? despesaMediaHistorica(escopoMeses, transacoesTodas, categoriasMap) : null;
  const reservaAlvo = despesaMedia != null ? despesaMedia * PERFIL_INVESTIDOR.mesesReservaAlvo : null;

  return {
    latest, prev, months: escopoMeses,
    mesPct: mes?.pct ?? null, cdiPct: latest.benchmarks?.CDI?.valor ?? null,
    tiposArr: tiposDoMes(assetTipoMap, latest), gruposArr: grupos,
    ag, agAnt, despesasCat, despesasCatAnt,
    pctCaixa, reservaAtual, reservaAlvo, despesaMediaHist: despesaMedia,
    sobraPct: ag.receita ? (ag.sobra / ag.receita) * 100 : null,
    despesaAtual: ag.despesa, despesaAnterior: agAnt ? agAnt.despesa : null,
    parceladoFuturo: null, receitaMensal: ag.receita,
    mes,
  };
}

/* ── Insight Engine: 10 regras puras, cada uma olha o ctx e devolve um
   insight ou null. Prioridade decide a ordem de exibição. ── */
let _insightSeq = 0;
const criarInsight = (tipo, categoria, prioridade, titulo, descricao, impacto, acao) => ({
  id: `ins-${++_insightSeq}`, tipo, categoria, prioridade, titulo, descricao,
  impactoFinanceiro: impacto ?? null, acaoSugerida: acao ?? null,
});

function regraRentabilidadeVsCDI(ctx) {
  if (ctx.mesPct == null || ctx.cdiPct == null) return null;
  const diff = ctx.mesPct - ctx.cdiPct;
  if (diff >= 0.3) return criarInsight("Sucesso", "rentabilidade", "baixa", "Carteira bateu o CDI", `A carteira rendeu ${diff.toFixed(2)} p.p. acima do CDI este mês.`);
  if (diff <= -0.3) return criarInsight("Alerta", "rentabilidade", "media", "Carteira abaixo do CDI", `A carteira rendeu ${Math.abs(diff).toFixed(2)} p.p. abaixo do CDI este mês.`);
  return null;
}
function regraRecordePatrimonial(ctx) {
  if (!ctx.months?.length) return null;
  const totais = ctx.months.map((m) => totalDoMes(m));
  const atual = totais[totais.length - 1];
  const max = Math.max(...totais);
  if (atual >= max && totais.length > 1) return criarInsight("Conquista", "patrimonio", "baixa", "Novo recorde de patrimônio", `Patrimônio total atingiu ${atual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, o maior valor do histórico.`);
  return null;
}
function regraQuedaPatrimonial(ctx) {
  if (!ctx.prev) return null;
  const totAnt = totalDoMes(ctx.prev), totAtual = totalDoMes(ctx.latest);
  if (totAtual < totAnt) return criarInsight("Risco", "patrimonio", "alta", "Patrimônio caiu no mês", `Patrimônio total caiu de ${totAnt.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} para ${totAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`);
  return null;
}
function regraAporteAbaixoDoPadrao(ctx) {
  const historico = (ctx.months || []).slice(0, -1).map((m) => m.aportes?.total || 0).filter((v) => v > 0);
  if (!historico.length) return null;
  const media = historico.reduce((s, v) => s + v, 0) / historico.length;
  const atual = ctx.latest?.aportes?.total || 0;
  if (atual < media * 0.7) return criarInsight("Alerta", "aporte", "media", "Aporte abaixo do padrão", `Aporte de ${atual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ficou bem abaixo da média histórica (${media.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).`);
  return null;
}
function regraVariacaoCategoriaDespesa(ctx) {
  if (!ctx.despesasCat?.length || !ctx.despesasCatAnt) return null;
  const top = ctx.despesasCat[0];
  const antes = ctx.despesasCatAnt.find((c) => c.cat === top.cat);
  if (!antes || antes.valor < 1) return null;
  const variacao = ((top.valor - antes.valor) / antes.valor) * 100;
  if (Math.abs(variacao) >= 25 && Math.abs(top.valor - antes.valor) >= 50) {
    const tipo = variacao > 0 ? "Alerta" : "Sucesso";
    return criarInsight(tipo, "gastos", "media", `${top.cat} variou ${variacao > 0 ? "muito" : "bastante para menos"}`, `Categoria "${top.cat}" foi de ${antes.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} para ${top.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${variacao > 0 ? "+" : ""}${variacao.toFixed(0)}%).`);
  }
  return null;
}
function regraFluxoCaixaNegativo(ctx) {
  if (ctx.ag?.sobra == null) return null;
  if (ctx.ag.sobra < 0) return criarInsight("Risco", "fluxo", "alta", "Sobra negativa no mês", `Despesas + aportes superaram a receita em ${Math.abs(ctx.ag.sobra).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`);
  return null;
}
function regraExposicaoCartaoAlta(ctx) {
  if (ctx.parceladoFuturo == null || !ctx.receitaMensal) return null;
  if (ctx.parceladoFuturo / ctx.receitaMensal >= 1.0) return criarInsight("Risco", "cartao", "alta", "Exposição alta em cartão", "Parcelas futuras do cartão já equivalem a mais de um mês de receita.");
  return null;
}
function regraCaixaOcioso(ctx) {
  if (ctx.pctCaixa == null) return null;
  if (ctx.pctCaixa > 30) return criarInsight("Oportunidade", "liquidez", "baixa", "Caixa acima do necessário", `${ctx.pctCaixa.toFixed(0)}% do patrimônio está em caixa — considere investir o excedente.`);
  return null;
}
function regraReservaBaixa(ctx) {
  if (ctx.reservaAlvo == null) return null;
  if (ctx.reservaAtual < ctx.reservaAlvo * 0.9) return criarInsight("Alerta", "reserva", "media", "Reserva abaixo do alvo", `Reserva atual (${ctx.reservaAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) está abaixo do alvo de ${ctx.reservaAlvo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${PERFIL_INVESTIDOR.mesesReservaAlvo} meses de despesa).`);
  return null;
}
function regraRecordeProventos(ctx) {
  if (!ctx.months?.length) return null;
  const proventos = ctx.months.map((m) => m.proventos?.total || 0);
  const atual = proventos[proventos.length - 1];
  const max = Math.max(...proventos);
  if (atual > 0 && atual >= max && proventos.filter((v) => v > 0).length > 1) return criarInsight("Conquista", "proventos", "baixa", "Novo recorde de proventos", `Recebeu ${atual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em proventos este mês, o maior valor do histórico.`);
  return null;
}

const REGRAS_INSIGHT = [
  regraFluxoCaixaNegativo, regraExposicaoCartaoAlta, regraQuedaPatrimonial,
  regraReservaBaixa, regraVariacaoCategoriaDespesa, regraAporteAbaixoDoPadrao,
  regraRentabilidadeVsCDI, regraCaixaOcioso, regraRecordePatrimonial, regraRecordeProventos,
];
export const ORDEM_PRIORIDADE_INSIGHT = { alta: 0, media: 1, baixa: 2 };

export function gerarInsights(ctx) {
  return REGRAS_INSIGHT.map((regra) => regra(ctx)).filter(Boolean)
    .sort((a, b) => ORDEM_PRIORIDADE_INSIGHT[a.prioridade] - ORDEM_PRIORIDADE_INSIGHT[b.prioridade]);
}
