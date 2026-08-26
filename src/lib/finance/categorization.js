/* ═══════════════════════════════════════════════════════════════
   Agregação de fluxo de caixa, categorização automática e parsing
   tolerante de importação (CSV/XLSX).
   Portado quase verbatim de dashboardinvestimentos.jsx (linhas 1199-1330
   e 1037-1046). Único ajuste real: `regras` deixa de vir de
   window.storage e passa a ser argumento — ver src/data/rules.js.
   ═══════════════════════════════════════════════════════════════ */
import { normalizar, brl, num, pct } from "./format.js";

export function agregarTx(txs, categoriasMap) {
  let receita = 0, despesa = 0, aporte = 0;
  const porCategoria = {};
  txs.forEach((t) => {
    const tipo = categoriasMap[t.cat]?.tipo || "despesa";
    if (tipo === "receita") receita += t.valor;
    else if (tipo === "aporte") aporte += -t.valor;
    else despesa += -t.valor;
    porCategoria[t.cat] = (porCategoria[t.cat] || 0) + t.valor;
  });
  const sobra = receita - despesa - aporte;
  const taxaPoupanca = receita > 0 ? (aporte / receita) * 100 : null;
  return { receita, despesa, aporte, sobra, taxaPoupanca, porCategoria, n: txs.length };
}

export function categoriasDespesa(ag, categoriasMap) {
  return Object.entries(ag.porCategoria)
    .filter(([cat]) => categoriasMap[cat]?.tipo === "despesa")
    .map(([cat, v]) => ({ cat, valor: -v, cor: categoriasMap[cat]?.cor || "#525C4E" }))
    .sort((a, b) => b.valor - a.valor);
}
export function categoriasReceita(ag, categoriasMap) {
  return Object.entries(ag.porCategoria)
    .filter(([cat]) => categoriasMap[cat]?.tipo === "receita")
    .map(([cat, v]) => ({ cat, valor: v, cor: categoriasMap[cat]?.cor || "#525C4E" }))
    .sort((a, b) => b.valor - a.valor);
}

/* Só descreve o que o dado mostra, não inventa meta/orçamento. */
export function avaliarGastos(atual, anterior, categoriasMap) {
  const linhas = [];
  const cats = categoriasDespesa(atual, categoriasMap);
  if (!cats.length) return linhas;

  const top = cats[0];
  const pctTop = atual.despesa ? (top.valor / atual.despesa) * 100 : 0;
  linhas.push({ tipo: "neutro", texto: `${top.cat} foi a maior categoria: ${brl(top.valor)} — ${num(pctTop, 1)}% do gasto total.` });

  if (cats.length >= 3) {
    const top3 = cats.slice(0, 3).reduce((s, c) => s + c.valor, 0);
    const pctTop3 = atual.despesa ? (top3 / atual.despesa) * 100 : 0;
    linhas.push({ tipo: "neutro", texto: `As 3 maiores categorias (${cats.slice(0,3).map(c=>c.cat).join(", ")}) somam ${num(pctTop3, 1)}% do gasto.` });
  }

  if (anterior && anterior.despesa) {
    const diffTotal = atual.despesa - anterior.despesa;
    linhas.push({
      tipo: diffTotal >= 0 ? "alta" : "queda",
      texto: `Gasto total ${diffTotal >= 0 ? "subiu" : "caiu"} ${brl(Math.abs(diffTotal))} (${pct((diffTotal / anterior.despesa) * 100)}) em relação ao período anterior.`,
    });
    const comAmbos = cats
      .map((c) => ({ cat: c.cat, atual: c.valor, antes: -(anterior.porCategoria[c.cat] || 0) }))
      .map((c) => ({ ...c, diff: c.atual - c.antes }))
      .filter((c) => c.antes > 0 || c.atual > 0);
    const maiorAlta = [...comAmbos].sort((a, b) => b.diff - a.diff)[0];
    const maiorQueda = [...comAmbos].sort((a, b) => a.diff - b.diff)[0];
    if (maiorAlta && maiorAlta.diff > 1) linhas.push({ tipo: "alta", texto: `${maiorAlta.cat} foi quem mais subiu: +${brl(maiorAlta.diff)}.` });
    if (maiorQueda && maiorQueda.diff < -1) linhas.push({ tipo: "queda", texto: `${maiorQueda.cat} foi quem mais caiu: ${brl(maiorQueda.diff)}.` });
  }
  return linhas;
}

export function aplicarRegras(transacoes, regras) {
  return transacoes.map((t) => (regras[normalizar(t.desc)] ? { ...t, cat: regras[normalizar(t.desc)] } : t));
}

/* Seed inicial das palavras-chave — migra pra tabela categorization_rules
   na Fase 3, editável na tela de Categorização. */
export const PALAVRAS_CATEGORIA_SEED = [
  [["uber", "giftcard uber", "99 food", "99food", "ifood", "ifd*", "uberrides", "99pay"], "Transporte"],
  [["zaffari", "mercado", "supermercado", "atacad", "carrefour", "extra ", "unisuper"], "Mercado"],
  [["farmacia", "panvel", "drogasil", "drogaria", "pague menos"], "Farmácia"],
  [["posto ", "combustivel", "gasolina", "shell", "ipiranga", "petrobras", "buffon"], "Combustível"],
  [["fatura", "cartao inter", "cartao de credito"], "Cartão de crédito"],
  [["pix recebido"], "PIX recebido"],
  [["salario", "folha de pagamento", "pro-labore"], "Salário"],
  [["dividendo", "jcp", "rendimento", "provento"], "Dividendos"],
  [["nota bov", "corretagem", " b3 ", "aporte"], "Investimentos"],
  [["aluguel", "condominio", "iptu"], "Moradia"],
  [["energia", "cemig", "rge", "celesc", "equatorial"], "Energia"],
  [["saneamento", "corsan", "sabesp", "agua"], "Água"],
  [["internet", "vivo fibra", "claro net", "net virtua", "rl servicos de ti"], "Internet"],
  [["telefone", "claro flex", "vivo", "claro", "tim", "oi "], "Telefone"],
  [["netflix", "spotify", "assinatura", "amazon prime", "hbo", "disney", "youtube", "chatgpt", "openai", "uber one", "uber *one", "google brasil pagamentos", "bytedance"], "Assinaturas"],
  [["imposto", "darf", "irpf", "ipva", "iof"], "Impostos"],
  [["portoseg", "seguradora", "seguro "], "Seguro"],
  [["evolution sports"], "Atividades da filha"],
  [["isabella lubaya"], "Mesada"],
  [["leonardo barros ribeiro", "pamela amaral de freitas"], "Empréstimos"],
  [["colegio", "escola", "faculdade", "curso", "pciconcursos"], "Educação"],
  [["kabum", "boticario", "inter shop", "steam", "amazon", "mercado livre"], "Compras"],
  [["loteria", "aposta", "bar ", "balada", "cinema", "show"], "Lazer"],
  [["cashback"], "Outras receitas"],
  [["dep din 24hrs", "dep saquepague", "deposito"], "Outras receitas"],
];

export function categorizarPorPalavra(desc, palavrasCategoria = PALAVRAS_CATEGORIA_SEED) {
  const d = normalizar(desc);
  for (const [chaves, cat] of palavrasCategoria) if (chaves.some((k) => d.includes(k))) return cat;
  return "Outros";
}

/* ── Parsing tolerante para CSV/Excel de bancos diferentes ── */
export function detectarColunas(fields) {
  const achar = (candidatos) => fields.find((f) => candidatos.some((c) => normalizar(f).includes(c)));
  return {
    colData: achar(["data", "date"]),
    colDesc: achar(["descric", "historic", "lancamento", "memo", "description"]),
    colValor: achar(["valor", "amount", "value"]),
  };
}
export function parseValorImportado(v) {
  if (typeof v === "number") return v;
  if (!v && v !== 0) return null;
  let s = String(v).trim().replace(/[R$\s]/g, "");
  if (/,\d{1,2}$/.test(s) && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
export function parseDataImportada(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + v * 864e5).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/* NOVO (não existia no arquivo original): hash de dedup pra idempotência
   de importação — mesma transação reimportada não duplica. Fase 2. */
export async function hashTransacao(t) {
  const base = `${t.data}|${normalizar(t.desc)}|${t.valor.toFixed(2)}|${t.banco || ""}`;
  const enc = new TextEncoder().encode(base);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
