import { supabase } from "./supabaseClient.js";

/* Foto de perfil — sobe pro bucket "avatars" (uma pasta por usuário,
   um arquivo fixo "avatar.<ext>" que sobrescreve a anterior) e grava a
   URL pública em user_metadata.avatar_url, de onde o AccountMenu já lê. */
export async function enviarFotoPerfil(file) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData.user.id;
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `${userId}/avatar.${ext}`;

  const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`; // cache-busting: mesmo path, arquivo novo

  const { error: metaErr } = await supabase.auth.updateUser({ data: { avatar_url: url } });
  if (metaErr) throw metaErr;

  return url;
}

export async function removerFotoPerfil() {
  const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
  if (error) throw error;
}
