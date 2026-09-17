import { supabase } from "./supabaseClient.js";
import { getTetoMeiMap } from "./settings.js";

/* Camada de dados de NFS-e (MEI) — único lugar que fala com a tabela
   `nfse`. Schema REAL em produção (supabase/sql/001_schema.sql, estendido
   por 04-NFSE-PAGAMENTO-TETO-MEI.sql): numero, chave, competencia, emissao,
   valor, tomador, descricao, status (revisão da extração), hash_dedup,
   raw_xml — e reaproveita recebimento_iso/conta_recebimento (já existiam,
   sem uso) como status de pagamento: recebimento_iso NULL = aguardando,
   preenchido = recebido nessa data. Não existe coluna descricao_servico
   nem status_pagamento — cuidado se for portar de outra versão do schema. */

async function uid() {
  const { data } = await supabase.auth.getUser();
  return data.user.id;
}

export async function existeNFSe(hashDedup) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("nfse")
    .select("id")
    .eq("user_id", userId)
    .eq("hash_dedup", hashDedup)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function salvarNFSe(nfse) {
  const userId = await uid();
  const { error } = await supabase.from("nfse").insert({
    user_id: userId,
    numero: nfse.numero || null,
    chave: nfse.chave || null,
    competencia: nfse.competencia,
    emissao: nfse.competencia,
    valor: nfse.valor,
    tomador: nfse.tomador,
    descricao: nfse.descricaoServico || null,
    status: "pendente_revisao",
    hash_dedup: nfse.hashDedup,
    raw_xml: nfse.raw || null,
  });
  if (error) throw error;
}

export async function loadFilaRevisao() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("nfse")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pendente_revisao")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function loadNFSeConfirmadas() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("nfse")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "confirmada")
    .order("competencia", { ascending: false });
  if (error) throw error;
  return data;
}

export async function confirmarNFSe(id) {
  const userId = await uid();
  const { error } = await supabase.from("nfse").update({ status: "confirmada" }).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function rejeitarNFSe(id) {
  const userId = await uid();
  const { error } = await supabase.from("nfse").update({ status: "rejeitada" }).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

/* Status de pagamento não tem coluna própria — reaproveita recebimento_iso
   (já existia na tabela, sem uso): null = aguardando, data = recebido
   naquele dia. Independente do status de revisão. */
export async function marcarPagamento(id, statusPagamento) {
  const userId = await uid();
  const patch = { recebimento_iso: statusPagamento === "recebido" ? new Date().toISOString().slice(0, 10) : null };
  const { error } = await supabase.from("nfse").update(patch).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

/* Teto MEI: soma o valor de todas as NFS-e confirmadas no ano (por
   competência), independente de status de pagamento — faturamento conta
   pro limite MEI quando emitido, não quando recebido. */
export async function resumoTetoMei(ano) {
  const userId = await uid();
  const [{ data, error }, tetoMap] = await Promise.all([
    supabase
      .from("nfse")
      .select("valor, competencia")
      .eq("user_id", userId)
      .eq("status", "confirmada")
      .gte("competencia", `${ano}-01-01`)
      .lte("competencia", `${ano}-12-31`),
    getTetoMeiMap(),
  ]);
  if (error) throw error;
  const faturado = (data || []).reduce((soma, n) => soma + Number(n.valor), 0);
  const teto = tetoMap[String(ano)] || { limite: 81000, tolerancia: 97200 };
  return {
    faturado,
    limite: teto.limite,
    tolerancia: teto.tolerancia,
    pctLimite: faturado / teto.limite,
    restanteAteLimite: teto.limite - faturado,
    restanteAteTolerancia: teto.tolerancia - faturado,
  };
}
