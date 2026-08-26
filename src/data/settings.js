import { supabase } from "./supabaseClient.js";
import { ASSET_GROUP_SEED, ASSET_TIPO_SEED, CATEGORIAS_SEED } from "../lib/finance/taxonomy.js";
import { PALAVRAS_CATEGORIA_SEED } from "../lib/finance/categorization.js";

/* Camada de configuração — substitui as constantes hardcoded ASSET_GROUP/
   ASSET_TIPO/CATEGORIAS/PALAVRAS_CATEGORIA por linhas editáveis na tabela
   `settings`. getOrSeedSetting garante que na primeira vez que o app roda
   pra um usuário novo, o seed vira a config inicial dele — depois disso
   o usuário edita pela interface e o seed nunca mais sobrescreve (ao
   contrário do padrão __seedVersion do arquivo original, que resetava
   sempre que a constante mudava). */
async function getOrSeedSetting(chave, seedValue) {
  const { data, error } = await supabase.from("settings").select("valor").eq("chave", chave).maybeSingle();
  if (error) throw error;
  if (data) return data.valor;
  const { data: userData } = await supabase.auth.getUser();
  const { error: insertErr } = await supabase.from("settings").insert({
    user_id: userData.user.id,
    chave,
    valor: seedValue,
  });
  if (insertErr) throw insertErr;
  return seedValue;
}

export const getAssetGroupMap = () => getOrSeedSetting("asset_group", ASSET_GROUP_SEED);
export const getAssetTipoMap = () => getOrSeedSetting("asset_tipo", ASSET_TIPO_SEED);
export const getCategoriasMap = () => getOrSeedSetting("categorias", CATEGORIAS_SEED);
export const getPalavrasCategoria = () => getOrSeedSetting("palavras_categoria", PALAVRAS_CATEGORIA_SEED);

export async function updateSetting(chave, valor) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("settings").upsert({ user_id: userData.user.id, chave, valor, updated_at: new Date().toISOString() });
  if (error) throw error;
}
