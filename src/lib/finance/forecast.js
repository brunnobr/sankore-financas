/* ════════════════════════════════════════════════════════════════
   Forecast — cenários de longo prazo (juros compostos sobre premissa
   editável) + prévia do mês em curso. Portado do monolito
   dashboard-investimentos.jsx (Fase 5 do Personal CFO), com um corte:
   lá a prévia incluía fatura de cartão digitada à mão num objeto fixo
   (COMPROMISSOS_AGOSTO) — aqui a tela Cartão ainda é placeholder, sem
   essa tabela plugada, então a prévia usa só o que dá pra provar com
   dado real: extrato já lançado + recorrentes detectados do histórico
   + estimativa da parte variável pela média. Tudo rotulado "cenário"/
   "estimativa", nunca "previsão" — com poucos meses de histórico,
   projetar não é estatística, é aritmética sobre premissa que o
   usuário escolhe e pode errar.
   ═══════════════════════════════════════════════════════════════ */
import { agregarTx } from "./categorization.js";
import { normalizar } from "./format.js";
import { PERFIL_INVESTIDOR } from "./score.js";

/* Valor futuro de um principal + aporte mensal constante, taxa mensal
   constante — fórmula padrão de anuidade. taxaMensalDecimal em fração
   (0.01 = 1%), não em %. */
export function valorFuturo(principal, aporteMensal, taxaMensalDecimal, meses) {
  if (taxaMensalDecimal === 0) return principal + aporteMensal * meses;
  const fatorPrincipal = Math.pow(1 + taxaMensalDecimal, meses);
  const fatorAporte = aporteMensal * (fatorPrincipal - 1) / taxaMensalDecimal;
  return principal * fatorPrincipal + fatorAporte;
}

/* Taxa anual (%) pra taxa mensal equivalente composta (decimal). */
export function taxaAnualParaMensalDec(taxaAnualPct) {
  return Math.pow(1 + taxaAnualPct / 100, 1 / 12) - 1;
}

export const HORIZONTES_FORECAST = [
  { key: "30d", label: "30 dias", meses: 1 },
  { key: "90d", label: "90 dias", meses: 3 },
  { key: "1a", label: "1 ano", meses: 12 },
  { key: "5a", label: "5 anos", meses: 60 },
  { key: "10a", label: "10 anos", meses: 120 },
  { key: "20a", label: "20 anos", meses: 240 },
];
export const CENARIOS_FORECAST = [
  { key: "conservador", label: "Conservador", ajustePP: -3, cor: "var(--debit)" },
  { key: "base", label: "Base (sua premissa)", ajustePP: 0, cor: "var(--credit)" },
  { key: "otimista", label: "Otimista", ajustePP: 3, cor: "#7c3aed" },
];

/* Projeta patrimônio total num horizonte, separado em reserva (piso que
   acompanha a despesa média corrigida pela inflação — mesmo modelo do
   PERFIL_INVESTIDOR usado no score) e crescimento (o excedente,
   compondo à taxa de rentabilidade do cenário). Simplificação
   deliberada: todo o aporte vai pra crescimento e a reserva atual fica
   estática em termos nominais — é a leitura mais conservadora (não
   assume que a reserva vai se corrigir sozinha) e mais fácil de
   auditar do que tentar modelar o aporte se dividindo entre as duas. */
export function projetarCenario({ reservaAtual, despesaMediaHoje, crescimentoAtual, aporteMensal, rentabilidadeAA, inflacaoAA, meses }) {
  const inflMensalDec = taxaAnualParaMensalDec(inflacaoAA);
  const rentMensalDec = taxaAnualParaMensalDec(rentabilidadeAA);

  const despesaFutura = despesaMediaHoje * Math.pow(1 + inflMensalDec, meses);
  const reservaAlvoFutura = despesaFutura * PERFIL_INVESTIDOR.mesesReservaAlvo;

  const crescimentoFuturo = valorFuturo(crescimentoAtual, aporteMensal, rentMensalDec, meses);
  const totalFuturo = reservaAtual + crescimentoFuturo;
  return { reservaAlvoFutura, crescimentoFuturo, totalFuturo, aportadoTotal: aporteMensal * meses };
}

/* ── Prévia do mês em curso ──────────────────────────────────────
   Recorrentes: descrição que se repete em pelo menos `minMeses` meses
   distintos nos últimos 12. Não é lista escrita à mão — sai do próprio
   histórico, então se um gasto sumir ou aparecer, a prévia acompanha
   sozinha. O mês corrente fica de fora da detecção (ainda em
   andamento, não dá pra saber se o gasto recorrente já "não veio" ou
   só ainda não chegou). */
export function detectarRecorrentes(transacoes, mesCorrenteYM, minMeses = 4, valorMinimo = 20) {
  const g = {};
  const janela = transacoes.filter((t) => t.valor < 0 && t.data.slice(0, 7) !== mesCorrenteYM);
  janela.forEach((t) => {
    const k = normalizar(t.desc).replace(/[^a-z ]/g, "").trim().slice(0, 26);
    (g[k] = g[k] || []).push(t);
  });
  return Object.entries(g).map(([k, itens]) => {
    const meses = [...new Set(itens.map((t) => t.data.slice(0, 7)))];
    const media = itens.reduce((s, t) => s + Math.abs(t.valor), 0) / meses.length;
    return { chave: k, desc: itens[0].desc, cat: itens[0].cat, meses: meses.length, media };
  }).filter((r) => r.meses >= minMeses && r.media >= valorMinimo)
    .sort((a, b) => b.media - a.media);
}

/* Monta a prévia do mês corrente somando COMPONENTES, não ancorando na
   média total — se o mês já tem gasto real lançado, ele conta como
   fato, não como estimativa. `medias` = receita/despesa/aporte médios
   dos últimos N meses (ver mediasHistoricas). Sem fatura de cartão
   confirmada aqui (ver cabeçalho do arquivo) — só recorrentes
   detectados + resto variável estimado pela média. */
export function previaMesAtual(transacoes, mesCorrenteYM, categoriasMap, medias) {
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

  const doMes = transacoes.filter((t) => t.data.slice(0, 7) === mesCorrenteYM);
  const agRealizado = agregarTx(doMes, categoriasMap);
  const temRealizado = doMes.length > 0;

  const recorrentes = detectarRecorrentes(transacoes, mesCorrenteYM);
  const jaOcorreu = (r) => doMes.some((t) => normalizar(t.desc).replace(/[^a-z ]/g, "").trim().slice(0, 26) === r.chave);
  const recorrentesPendentes = recorrentes.filter((r) => !jaOcorreu(r));
  const totalRecorrentePendente = recorrentesPendentes.reduce((s, r) => s + r.media, 0);

  const variavelTotal = Math.max(0, medias.despesa - recorrentes.reduce((s, r) => s + r.media, 0));
  const fracaoRestante = Math.max(0, 1 - diaAtual / diasNoMes);
  const variavelPendente = variavelTotal * fracaoRestante;

  const despesaPrevista = agRealizado.despesa + totalRecorrentePendente + variavelPendente;
  const receitaEstimada = Math.max(0, medias.receita - agRealizado.receita);
  const receitaPrevista = agRealizado.receita + receitaEstimada;
  const aportePrevisto = Math.max(agRealizado.aporte, medias.aporte);
  const desvioVsMedia = despesaPrevista - medias.despesa;

  return {
    ym: mesCorrenteYM, temRealizado, diaAtual, diasNoMes, agRealizado,
    recorrentes: recorrentesPendentes, totalRecorrente: totalRecorrentePendente,
    restoEstimado: variavelPendente, despesaPrevista,
    receitaEstimada, receitaPrevista, aportePrevisto, desvioVsMedia,
    despesaMedia: medias.despesa,
    sobraPrevista: receitaPrevista - despesaPrevista - aportePrevisto,
    pctAncorado: despesaPrevista ? (agRealizado.despesa / despesaPrevista) * 100 : 0,
  };
}
