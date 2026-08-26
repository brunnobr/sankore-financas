import { supabase } from "./supabaseClient.js";

async function uid() {
  const { data } = await supabase.auth.getUser();
  return data.user.id;
}

/* Carrega as regras de correção do usuário (categorization_rules) já
   no formato {descricaoNormalizada: categoria} que aplicarRegras()
   espera. */
export async function loadRegrasUsuario() {
  const userId = await uid();
  const { data, error } = await supabase.from("categorization_rules").select("padrao, categoria").eq("user_id", userId);
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.padrao, r.categoria]));
}

export async function salvarRegraCategorizacao(descricaoNormalizada, categoria) {
  const userId = await uid();
  const { error } = await supabase
    .from("categorization_rules")
    .upsert({ user_id: userId, padrao: descricaoNormalizada, categoria }, { onConflict: "user_id,padrao" });
  if (error) throw error;
}

/* Grava as transações confirmadas na fila de revisão. Duplicata (mesmo
   hash_dedup) é ignorada silenciosamente pelo unique constraint —
   idempotente ao reimportar o mesmo extrato. */
export async function importarTransacoes(transacoes, bancoDefault) {
  const userId = await uid();
  const linhas = transacoes.map((t) => ({
    user_id: userId,
    data: t.data,
    descricao: t.desc,
    categoria: t.cat,
    banco: t.banco || bancoDefault,
    valor: t.valor,
    hash_dedup: t.hash,
  }));
  const { data, error } = await supabase
    .from("transactions")
    .upsert(linhas, { onConflict: "user_id,hash_dedup", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return { importadas: data.length, duplicadas: linhas.length - data.length };
}

export async function loadTransacoes({ de, ate } = {}) {
  const userId = await uid();
  let q = supabase.from("transactions").select("*").eq("user_id", userId).order("data", { ascending: false });
  if (de) q = q.gte("data", de);
  if (ate) q = q.lte("data", ate);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((t) => ({ data: t.data, desc: t.descricao, cat: t.categoria, banco: t.banco, valor: Number(t.valor), id: t.id }));
}
