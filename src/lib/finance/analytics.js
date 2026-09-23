/* ════════════════════════════════════════════════════════════════
   Motor de agregação da tela Analytics — período/comparação, séries
   pra gráfico, indicadores financeiros e insights derivados de dados
   reais. Reaproveita agregarTx/categoriasDespesa/categoriasReceita/
   variacaoPct (categorization.js) e investido/totalDoMes/caixaDoMes/
   gruposDoMes/retornoMes (returns.js) — nenhuma fórmula duplicada.

   O que este arquivo NÃO tenta calcular, por falta de fonte de dado
   na base hoje (ver levantamento antes de mexer aqui de novo):
   - despesa fixa vs variável (não existe atributo de categoria pra isso)
   - centro de custo (não existe)
   - limite de cartão / fatura / parcelamento futuro (tabelas
     card_installment_plans/card_charges/card_invoices existem no
     schema SQL mas nenhuma tela grava nelas ainda — Cartão é
     placeholder)
   - split Pessoa Física / Pessoa Jurídica (nfse não tem esse campo)
   Esses pontos aparecem na tela como "sem dados disponíveis", nunca
   como valor inventado ou zero.
   ═══════════════════════════════════════════════════════════════ */
import { agregarTx, categoriasDespesa, categoriasReceita, variacaoPct } from "./categorization.js";
import { normalizar } from "./format.js";
import { totalDoMes, retornoMes, investido } from "./returns.js";

export const PERIODOS = [
  { value: "mes", label: "Este mês" },
  { value: "mes-especifico", label: "Mês específico" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "ano", label: "Ano" },
  { value: "custom", label: "Personalizado" },
];

export const COMPARACOES = [
  { value: "anterior", label: "Período anterior" },
  { value: "anoAnterior", label: "Mesmo período do ano anterior" },
  { value: "nenhum", label: "Sem comparação" },
];

const N_PERIODO = { mes: 1, "3m": 3, "6m": 6, "12m": 12 };

/* `todasMeses` = lista ordenada ascendente de "YYYY-MM" com QUALQUER
   dado (transação ou fechamento de investimento) — a mesma união já
   usada em Dashboard.jsx pra não esconder mês com só um dos dois. */
export function resolverPeriodo(tipo, todasMeses, customIni, customFim, mesEspecifico, ano) {
  if (!todasMeses.length) return [];
  // Mês específico e Ano são recortes diretos de todasMeses (só meses
  // com dado real) — nunca inventam um mês vazio que o usuário ainda
  // não fechou/importou.
  if (tipo === "mes-especifico") {
    return mesEspecifico && todasMeses.includes(mesEspecifico) ? [mesEspecifico] : [];
  }
  if (tipo === "ano") {
    return ano ? todasMeses.filter((ym) => ym.slice(0, 4) === String(ano)) : [];
  }
  if (tipo === "custom") {
    if (!customIni || !customFim || customIni > customFim) return [];
    const meses = [];
    let [y, m] = customIni.split("-").map(Number);
    const [yFim, mFim] = customFim.split("-").map(Number);
    while (y < yFim || (y === yFim && m <= mFim)) {
      meses.push(`${y}-${String(m).padStart(2, "0")}`);
      m++; if (m > 12) { m = 1; y++; }
    }
    return meses;
  }
  const n = N_PERIODO[tipo] || 1;
  return todasMeses.slice(-n);
}

/* Bloco imediatamente anterior, mesmo tamanho, terminando um mês antes
   do primeiro selecionado. Retorna [] (não null) quando não há meses
   suficientes — a UI mostra "sem dados" nesse caso. */
function blocoAnterior(mesesSelecionados, tamanho) {
  const meses = [];
  let [y, m] = mesesSelecionados[0].split("-").map(Number);
  for (let i = 0; i < tamanho; i++) {
    m--; if (m < 1) { m = 12; y--; }
    meses.unshift(`${y}-${String(m).padStart(2, "0")}`);
  }
  return meses;
}

export function resolverComparacao(modo, mesesSelecionados, todasMeses) {
  if (modo === "nenhum" || !mesesSelecionados.length) return null;
  const disponiveis = new Set(todasMeses);
  if (modo === "anterior") {
    const bloco = blocoAnterior(mesesSelecionados, mesesSelecionados.length);
    return bloco.some((m) => disponiveis.has(m)) ? bloco : null;
  }
  if (modo === "anoAnterior") {
    const bloco = mesesSelecionados.map((ym) => {
      const [y, m] = ym.split("-").map(Number);
      return `${y - 1}-${String(m).padStart(2, "0")}`;
    });
    return bloco.some((m) => disponiveis.has(m)) ? bloco : null;
  }
  return null;
}

/* ── Visão financeira (seção 3) ── */
export function agregarPeriodo(transacoes, categoriasMap, meses) {
  const set = new Set(meses);
  const filtradas = transacoes.filter((t) => set.has(t.data.slice(0, 7)));
  const ag = agregarTx(filtradas, categoriasMap);
  const resultadoOperacional = ag.receita - ag.despesa;
  const fluxoLiquido = resultadoOperacional - ag.aporte;
  return { ...ag, resultadoOperacional, fluxoLiquido, transacoes: filtradas };
}

/* ── Fluxo financeiro mês a mês (seção 4), pro gráfico de linha ── */
export function serieFluxoMensal(transacoes, categoriasMap, meses) {
  return meses.map((ym) => {
    const ag = agregarPeriodo(transacoes, categoriasMap, [ym]);
    return { mes: ym, receita: ag.receita, despesa: ag.despesa, aporte: ag.aporte, resultadoOperacional: ag.resultadoOperacional, fluxoLiquido: ag.fluxoLiquido };
  });
}

/* ── Evolução patrimonial (seção 5) — separa quanto do crescimento veio
   de aporte novo vs valorização, mês a mês, reaproveitando retornoMes. ── */
export function seriePatrimonial(months, assetGroupMap, meses) {
  const set = new Set(meses);
  return months
    .filter((m) => set.has(m.key.slice(0, 7)))
    .map((m) => {
      const idx = months.indexOf(m);
      const prev = idx > 0 ? months[idx - 1] : null;
      const r = retornoMes(assetGroupMap, prev, m);
      return {
        mes: m.key.slice(0, 7),
        // investido, não totalDoMes: caixa (CDB/poupança usado como
        // conta corrente) fica fora da evolução patrimonial.
        patrimonio: investido(assetGroupMap, m),
        aporte: r?.aporte ?? m.aportes?.total ?? 0,
        rentabilidade: r?.rent ?? null,
      };
    });
}

/* ── Despesas por categoria com variação (seção 6) ── */
export function despesasComVariacao(agAtual, agAnterior, categoriasMap) {
  const atuais = categoriasDespesa(agAtual, categoriasMap);
  const total = agAtual.despesa || 0;
  return atuais.map((c) => {
    const antes = agAnterior ? -(agAnterior.porCategoria[c.cat] || 0) : null;
    return { ...c, pct: total ? (c.valor / total) * 100 : 0, variacao: antes != null ? variacaoPct(c.valor, antes) : null };
  });
}

/* ── Maiores despesas — agrupa por descrição normalizada (não existe
   campo "estabelecimento" separado da descrição do lançamento). ── */
export function maioresDespesas(transacoesFiltradas, categoriasMap, topN = 10) {
  const grupos = {};
  for (const t of transacoesFiltradas) {
    if ((categoriasMap[t.cat]?.tipo || "despesa") !== "despesa") continue;
    const chave = normalizar(t.desc);
    grupos[chave] ??= { desc: t.desc, cat: t.cat, valor: 0, n: 0, ids: [] };
    grupos[chave].valor += -t.valor;
    grupos[chave].n += 1;
    grupos[chave].ids.push(t.id);
  }
  return Object.values(grupos).sort((a, b) => b.valor - a.valor).slice(0, topN);
}

/* ── Receitas por origem, com recorrência estatística (seção 7) —
   "recorrente" aqui é observado (apareceu em >=80% dos meses do
   histórico disponível), nunca uma categoria fixa pré-definida. ── */
export function receitasComRecorrencia(transacoes, categoriasMap, agAtual, agAnterior, todasMeses) {
  const atuais = categoriasReceita(agAtual, categoriasMap);
  const total = agAtual.receita || 0;
  const janela = todasMeses.slice(-12);
  return atuais.map((c) => {
    const antes = agAnterior ? (agAnterior.porCategoria[c.cat] || 0) : null;
    const mesesComReceita = janela.filter((ym) =>
      transacoes.some((t) => t.data.slice(0, 7) === ym && t.cat === c.cat && (categoriasMap[t.cat]?.tipo === "receita"))
    ).length;
    const presenca = janela.length ? mesesComReceita / janela.length : 0;
    return {
      ...c,
      pct: total ? (c.valor / total) * 100 : 0,
      variacao: antes != null ? variacaoPct(c.valor, antes) : null,
      recorrencia: janela.length < 3 ? null : (presenca >= 0.8 ? "recorrente" : "variável"),
      presencaMeses: mesesComReceita,
      janelaMeses: janela.length,
    };
  }).sort((a, b) => b.valor - a.valor);
}

/* ── Indicadores financeiros (seção 11) — cada um vem com `semDados` +
   `motivo` explícito quando a base não sustenta o cálculo, nunca um
   valor forjado. ── */
export function indicadoresFinanceiros({ agAtual, patrimonioAtual, patrimonioAnterior, reservaAtual, despesaMediaMensal, principalFontePct }) {
  const ind = [];

  ind.push({
    chave: "taxaPoupanca", label: "Taxa de poupança", formula: "(Receitas − Despesas) / Receitas",
    valor: agAtual.receita ? ((agAtual.receita - agAtual.despesa) / agAtual.receita) * 100 : null,
    unidade: "pct",
  });
  ind.push({
    chave: "taxaInvestimento", label: "Taxa de investimento", formula: "Aportes / Receitas",
    valor: agAtual.receita ? (agAtual.aporte / agAtual.receita) * 100 : null,
    unidade: "pct",
  });
  ind.push({
    chave: "comprometimentoRenda", label: "Comprometimento de renda", formula: "Despesas fixas / Receitas",
    valor: null, semDados: true,
    motivo: "As categorias ainda não são classificadas como fixas ou variáveis.",
  });
  ind.push({
    chave: "coberturaReserva", label: "Cobertura da reserva", formula: "Reserva / Despesa média mensal",
    valor: despesaMediaMensal ? reservaAtual / despesaMediaMensal : null,
    unidade: "meses",
    semDados: !despesaMediaMensal,
    motivo: !despesaMediaMensal ? "Histórico de despesas insuficiente para calcular uma média mensal." : undefined,
  });
  ind.push({
    chave: "crescimentoPatrimonial", label: "Crescimento patrimonial", formula: "Patrimônio atual vs período anterior",
    valor: patrimonioAnterior != null && patrimonioAnterior > 0 ? ((patrimonioAtual - patrimonioAnterior) / patrimonioAnterior) * 100 : null,
    unidade: "pct",
    semDados: patrimonioAnterior == null,
    motivo: patrimonioAnterior == null ? "Sem fechamento de investimentos no período de comparação." : undefined,
  });
  ind.push({
    chave: "utilizacaoCredito", label: "Utilização de crédito", formula: "Limite utilizado / Limite total",
    valor: null, semDados: true, motivo: "Nenhum cartão conectado ainda (aba Cartão em construção).",
  });
  ind.push({
    chave: "dependenciaFontePrincipal", label: "Dependência da principal fonte de renda", formula: "Principal fonte / Receita total",
    valor: principalFontePct, unidade: "pct",
    semDados: principalFontePct == null,
    motivo: principalFontePct == null ? "Sem receitas no período selecionado." : undefined,
  });
  ind.push({
    chave: "endividamento", label: "Endividamento", formula: "Dívidas / Patrimônio ou Renda",
    valor: null, semDados: true, motivo: "Nenhuma dívida ou empréstimo é rastreado no sistema ainda.",
  });

  return ind;
}

/* ── Insights automáticos (seção 12) — só entra na lista quando o dado
   sustenta a afirmação; nunca causal ("por quê"), só o que os números
   mostram. ── */
export function insightsAvancados({ despesasVar, receitasRec, aportesHistorico, patrimonioDelta, agAtual }) {
  const insights = [];

  const maiorAlta = despesasVar.filter((c) => c.variacao != null && c.variacao >= 20 && c.valor >= 50).sort((a, b) => b.variacao - a.variacao)[0];
  if (maiorAlta) {
    insights.push({ tipo: "alerta", titulo: "Despesa acima da média", texto: `${maiorAlta.cat} aumentou ${maiorAlta.variacao.toFixed(0)}% em relação ao período de comparação.` });
  }
  const maiorQueda = despesasVar.filter((c) => c.variacao != null && c.variacao <= -20 && c.valor >= 50).sort((a, b) => a.variacao - b.variacao)[0];
  if (maiorQueda) {
    insights.push({ tipo: "positivo", titulo: "Categoria em queda", texto: `${maiorQueda.cat} caiu ${Math.abs(maiorQueda.variacao).toFixed(0)}% em relação ao período de comparação.` });
  }

  const principal = receitasRec[0];
  if (principal && principal.pct >= 60) {
    insights.push({ tipo: "atencao", titulo: "Concentração de renda", texto: `${principal.pct.toFixed(0)}% das receitas vieram de "${principal.cat}" no período.` });
  }

  if (aportesHistorico && aportesHistorico.total >= 3) {
    insights.push({ tipo: "positivo", titulo: "Aportes consistentes", texto: `Você realizou aportes em ${aportesHistorico.comAporte} dos últimos ${aportesHistorico.total} meses.` });
  }

  if (patrimonioDelta && patrimonioDelta.total != null) {
    const { total, aporte, valorizacao } = patrimonioDelta;
    if (total >= 0) {
      insights.push({ tipo: "positivo", titulo: "Crescimento patrimonial", texto: `Seu patrimônio cresceu ${brlLocal(total)} no período${aporte != null && valorizacao != null ? ` — ${brlLocal(aporte)} vieram de aportes e ${brlLocal(valorizacao)} de valorização/rendimentos` : ""}.` });
    } else {
      insights.push({ tipo: "alerta", titulo: "Queda patrimonial", texto: `Seu patrimônio caiu ${brlLocal(Math.abs(total))} no período.` });
    }
  }

  if (agAtual.sobra < 0) {
    insights.push({ tipo: "alerta", titulo: "Fluxo líquido negativo", texto: `Despesas e aportes superaram a receita em ${brlLocal(Math.abs(agAtual.sobra))} no período.` });
  }

  return insights;
}

function brlLocal(v) {
  return (v < 0 ? "−" : "") + "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Aportes: em quantos meses do histórico (até 12) houve aporte > 0 —
   reaproveitado tanto pro insight quanto, se quiser, fora daqui. */
export function historicoAportes(months, meses) {
  const set = new Set(meses);
  const escopo = months.filter((m) => set.has(m.key.slice(0, 7)));
  const comAporte = escopo.filter((m) => (m.aportes?.total || 0) > 0).length;
  return { total: escopo.length, comAporte };
}
