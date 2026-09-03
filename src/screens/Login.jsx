import { useState } from "react";
import { supabase, getManterLogado, setManterLogado } from "../data/supabaseClient.js";
import logoFinancas from "../assets/logo-financas.png";

/* Tela de login/cadastro. A senha é digitada aqui pelo próprio usuário,
   direto no formulário — nunca por terceiros, nunca fora deste fluxo. */
export default function Login() {
  const [modo, setModo] = useState("entrar"); // 'entrar' | 'cadastrar'
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [manterLogado, setManterLogadoState] = useState(getManterLogado());

  async function onSubmit(e) {
    e.preventDefault();
    setErro("");
    setAviso("");
    setCarregando(true);
    try {
      setManterLogado(manterLogado);
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password: senha });
        if (error) throw error;
        setAviso("Conta criada. Verifique seu e-mail para confirmar o acesso.");
      }
    } catch (err) {
      setErro(err.message || "Não foi possível entrar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sidebar-bg)" }}>
      <form onSubmit={onSubmit} style={{ background: "var(--panel)", padding: 36, borderRadius: "var(--radius)", width: 340, boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 28 }}>
          <img src={logoFinancas} alt="" style={{ width: 40, height: 40, borderRadius: 10 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
            SANKORE <span style={{ color: "var(--accent)" }}>FINANÇAS</span>
          </div>
        </div>

        <label style={{ display: "block", fontSize: 13, marginBottom: 4, color: "var(--ink-soft)" }}>E-mail</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 9, marginBottom: 16, border: "1px solid var(--rule)", borderRadius: 8, fontSize: 14 }} />

        <label style={{ display: "block", fontSize: 13, marginBottom: 4, color: "var(--ink-soft)" }}>Senha</label>
        <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)}
          style={{ width: "100%", padding: 9, marginBottom: 16, border: "1px solid var(--rule)", borderRadius: 8, fontSize: 14 }} />

        {modo === "entrar" && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)", marginBottom: 16, cursor: "pointer" }}>
            <input type="checkbox" checked={manterLogado} onChange={(e) => setManterLogadoState(e.target.checked)} />
            Manter logado neste dispositivo
          </label>
        )}

        {erro && <p style={{ color: "var(--debit)", fontSize: 13, marginBottom: 12 }}>{erro}</p>}
        {aviso && <p style={{ color: "var(--credit)", fontSize: 13, marginBottom: 12 }}>{aviso}</p>}

        <button type="submit" disabled={carregando}
          style={{ width: "100%", padding: 11, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
          {carregando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>

        <p style={{ marginTop: 16, fontSize: 13, textAlign: "center", color: "var(--ink-faint)" }}>
          {modo === "entrar" ? (
            <>Primeiro acesso? <a href="#" onClick={(e) => { e.preventDefault(); setModo("cadastrar"); }} style={{ color: "var(--accent)" }}>Criar conta</a></>
          ) : (
            <>Já tem conta? <a href="#" onClick={(e) => { e.preventDefault(); setModo("entrar"); }} style={{ color: "var(--accent)" }}>Entrar</a></>
          )}
        </p>
      </form>
    </div>
  );
}
