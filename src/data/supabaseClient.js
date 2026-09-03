import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local (veja .env.example)."
  );
}

/* "Manter logado": quando desmarcado, a sessão vai pro sessionStorage
   (some ao fechar o navegador) em vez do localStorage (sobrevive).
   A preferência em si sempre mora no localStorage, só decide pra onde
   o token de sessão vai. */
const MANTER_LOGADO_KEY = "sankore-manter-logado";

export function getManterLogado() {
  return localStorage.getItem(MANTER_LOGADO_KEY) !== "0";
}

export function setManterLogado(v) {
  localStorage.setItem(MANTER_LOGADO_KEY, v ? "1" : "0");
}

const storageDinamico = {
  getItem: (k) => (getManterLogado() ? localStorage : sessionStorage).getItem(k),
  setItem: (k, v) => (getManterLogado() ? localStorage : sessionStorage).setItem(k, v),
  removeItem: (k) => (getManterLogado() ? localStorage : sessionStorage).removeItem(k),
};

export const supabase = createClient(url, anonKey, { auth: { storage: storageDinamico } });
