import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload } from "lucide-react";
import { useAuth } from "../data/AuthContext.jsx";
import { enviarFotoPerfil, removerFotoPerfil } from "../data/profile.js";
import { Panel } from "./shared/ui.jsx";

function iniciais(nome) {
  return nome.trim().slice(0, 2).toUpperCase();
}

const fieldStyle = { padding: "10px 12px", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 13.5, color: "var(--ink)", background: "var(--panel)" };

export default function Configuracoes() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const user = session?.user;
  if (!user) return null;
  const nome = user.user_metadata?.full_name || user.email;
  const foto = user.user_metadata?.avatar_url;

  async function onArquivo(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErro("");
    setCarregando(true);
    try {
      await enviarFotoPerfil(file);
    } catch (e2) {
      setErro(e2.message || "Erro ao enviar a foto.");
    } finally {
      setCarregando(false);
    }
  }

  async function onRemover() {
    setErro("");
    setCarregando(true);
    try {
      await removerFotoPerfil();
    } catch (e2) {
      setErro(e2.message || "Erro ao remover a foto.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 }}>
      <button
        onClick={() => navigate(-1)}
        style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "transparent", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", cursor: "pointer" }}
      >
        <ArrowLeft size={16} strokeWidth={2} /> Voltar
      </button>

      <Panel title="Perfil">
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 22 }}>
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--sidebar-active-bg)", color: "var(--sidebar-active)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
            {foto ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : iniciais(nome)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg" onChange={onArquivo} disabled={carregando} style={{ display: "none" }} />
              <button
                onClick={() => inputRef.current.click()}
                disabled={carregando}
                style={{ padding: "8px 14px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <Upload size={14} strokeWidth={2} /> {carregando ? "Enviando…" : "Enviar foto"}
              </button>
              {foto && (
                <button
                  onClick={onRemover}
                  disabled={carregando}
                  style={{ padding: "8px 14px", background: "transparent", color: "var(--ink-faint)", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                >
                  Remover
                </button>
              )}
            </div>
            <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>PNG ou JPG, até 5MB.</span>
          </div>
        </div>

        {erro && <p style={{ color: "var(--debit)", marginBottom: 16 }}>{erro}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>Nome</div>
            <div style={fieldStyle}>{nome}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>E-mail</div>
            <div style={{ ...fieldStyle, color: "var(--ink-faint)" }}>{user.email}</div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
