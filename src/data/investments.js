import { supabase } from "./supabaseClient.js";

/* Camada de dados de investimentos — substitui SEED_ASSETS/MESES/APORTES/
   PROVENTOS/BENCHMARKS (arrays fixos de 3 meses) por tabelas reais que
   crescem mês a mês. loadMonths() reconstrói o mesmo shape `months` que
   buildSeed()/enrich() produziam no arquivo original, pra que returns.js
   (gruposDoMes, retornoMes, retornosPorAtivo etc.) continue funcionando
   sem alteração. */

async function uid() {
  const { data } = await supabase.auth.getUser();
  return data.user.id;
}

export async function loadMonths() {
  const userId = await uid();
  const [snaps, contribs, divs, benchs] = await Promise.all([
    supabase.from("asset_snapshots").select("month, ticker, valor").eq("user_id", userId).order("month"),
    supabase.from("contributions").select("*").eq("user_id", userId).order("month"),
    supabase.from("dividends").select("*").eq("user_id", userId).order("month"),
    supabase.from("benchmarks").select("*").eq("user_id", userId).order("month"),
  ]);
  if (snaps.error) throw snaps.error;
  if (contribs.error) throw contribs.error;
  if (divs.error) throw divs.error;
  if (benchs.error) throw benchs.error;

  const porMes = {};
  for (const s of snaps.data) {
    porMes[s.month] ??= { key: s.month, assets: [] };
    porMes[s.month].assets.push({ nome: s.ticker, valor: Number(s.valor) });
  }
  for (const c of contribs.data) {
    porMes[c.month] ??= { key: c.month, assets: [] };
    porMes[c.month].aportes = {
      total: Number(c.total), dataISO: c.data_iso, origem: c.origem,
      ativoBreakdown: c.breakdown, taxasDetalhe: c.taxas,
    };
  }
  for (const d of divs.data) {
    porMes[d.month] ??= { key: d.month, assets: [] };
    porMes[d.month].proventos = { total: Number(d.total), itens: d.itens };
  }
  const benchPorMes = {};
  for (const b of benchs.data) {
    benchPorMes[b.month] ??= {};
    benchPorMes[b.month][b.indice] = { valor: Number(b.valor), fonte: b.fonte };
  }

  const months = Object.values(porMes)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((m) => ({ ...m, fimISO: m.key, benchmarks: benchPorMes[m.key] || {} }));
  return months;
}

/* Atualização manual de saldo de um ativo (Banco Inter, cripto, cofrinhos —
   qualquer coisa sem extrato baixável: o usuário lê o valor de um print e
   registra aqui). Upsert por (mês, ticker): reenviar o mesmo mês corrige
   o valor em vez de duplicar. */
export async function salvarSnapshotAtivo({ ticker, mes, valor }) {
  const userId = await uid();
  const { error } = await supabase
    .from("asset_snapshots")
    .upsert({ user_id: userId, month: mes, ticker, valor }, { onConflict: "user_id,month,ticker" });
  if (error) throw error;
}

/* Sobe a captura de tela pra Edge Function (parse-investment-screenshot),
   que chama a API da Claude e devolve [{nome, valor, moeda?}] — nada é
   gravado aqui, só extraído; a revisão/gravação fica em
   ImportarPrintForm (Investimentos.jsx), mesmo padrão de fila de
   revisão do import de extrato. */
export async function extrairSaldosDePrint(imagens) {
  const { data, error } = await supabase.functions.invoke("parse-investment-screenshot", { body: { imagens } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.itens || [];
}

/* Migração única (Fase 1): grava mai/jun/jul-2026 + pendência BOVA11 (ago)
   a partir do registro-investimentos.md. Rodar uma vez, manualmente, não
   é chamada automaticamente em nenhum lugar do app. */
export async function seedFromRegistroInvestimentos() {
  const userId = await uid();
  const snapshots = [
    // mai/2026
    ...Object.entries({}).map(() => null), // placeholder — preenchido na Fase 1 com os 27 ativos por mês
  ].filter(Boolean);
  if (!snapshots.length) {
    // eslint-disable-next-line no-console
    console.warn("seedFromRegistroInvestimentos: dados de mai/jun/jul ainda não transcritos — ver Fase 1 no plano.");
    return;
  }
  const { error } = await supabase.from("asset_snapshots").insert(snapshots.map((s) => ({ ...s, user_id: userId })));
  if (error) throw error;
}
