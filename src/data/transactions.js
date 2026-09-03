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

/* Checklist de extratos já importados, por banco + mês — registrado a
   cada confirmação (upsert: reimportar o mesmo banco/mês atualiza a
   linha em vez de duplicar), pra responder de cara "o extrato de
   agosto/2026 do Banrisul já foi importado?". */
export async function registrarImportLog({ banco, arquivoNome, competencia, importadas, duplicadas }) {
  const userId = await uid();
  const { error } = await supabase.from("import_log").upsert(
    {
      user_id: userId,
      banco,
      competencia,
      arquivo_nome: arquivoNome,
      transacoes_importadas: importadas,
      transacoes_duplicadas: duplicadas,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,banco,competencia" }
  );
  if (error) throw error;
}

export async function loadImportLog() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("import_log")
    .select("*")
    .eq("user_id", userId)
    .order("competencia", { ascending: false })
    .order("banco", { ascending: true });
  if (error) throw error;
  return data;
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

/* Renomeia uma conta (ex: "Banco Inter •7821" -> "Inter PF") em todas as
   transações e no log de importação — não é um apelido só de exibição,
   vira o valor real gravado, então filtros e agrupamentos por "banco"
   continuam funcionando sem mudança. */
export async function renomearConta(bancoAntigo, novoNome) {
  const userId = await uid();
  const { error: e1 } = await supabase.from("transactions").update({ banco: novoNome }).eq("user_id", userId).eq("banco", bancoAntigo);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("import_log").update({ banco: novoNome }).eq("user_id", userId).eq("banco", bancoAntigo);
  if (e2) throw e2;
}

/* Recategorizar depois de já importado — não mexe em hash_dedup nem em
   mais nada, só corrige a categoria daquela linha. */
export async function atualizarCategoriaTransacao(id, categoria) {
  const userId = await uid();
  const { error } = await supabase.from("transactions").update({ categoria }).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}
