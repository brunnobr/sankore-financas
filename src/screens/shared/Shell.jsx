import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, TrendingUp, ArrowLeftRight, CreditCard, FileText,
  BarChart3, LineChart, Target, LogOut, Bell, Settings, Menu, ArrowLeft,
} from "lucide-react";
import { supabase } from "../../data/supabaseClient.js";
import { useAuth } from "../../data/AuthContext.jsx";
import logoFinancas from "../../assets/logo-financas.png";
import logoLabs from "../../assets/logo-labs.png";

/* Estado do menu mobile (sidebar em drawer) compartilhado entre Shell
   (dono do estado) e Topbar (botão hamburguer) — os dois vivem em
   árvores diferentes do App, então precisam de um contexto. */
const SidebarCtx = createContext(null);

function iniciais(nome) {
  return nome.trim().slice(0, 2).toUpperCase();
}

/* Avatar clicável no topo direito — abre o menu de conta (Configurações,
   Sair). Substitui o antigo bloco de usuário no rodapé da sidebar. */
function AccountMenu() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const user = session?.user;

  useEffect(() => {
    function onClickFora(e) {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false);
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, []);

  if (!user) return null;
  const nome = user.user_metadata?.full_name || user.email;
  const foto = user.user_metadata?.avatar_url;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setAberto((v) => !v)}
        style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 0 0 1px var(--rule)", background: "var(--sidebar-active-bg)", color: "var(--sidebar-active)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, cursor: "pointer", padding: 0, overflow: "hidden" }}
      >
        {foto ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : iniciais(nome)}
      </button>

      {aberto && (
        <div style={{ position: "absolute", top: 66, right: 0, width: 210, background: "var(--panel)", border: "1px solid var(--rule)", borderRadius: 12, boxShadow: "0 4px 10px rgba(16,21,28,.06), 0 12px 28px rgba(16,21,28,.08)", padding: 8, zIndex: 20 }}>
          <div style={{ padding: "8px 10px 10px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
          </div>
          <div style={{ height: 1, background: "var(--rule)", margin: "2px 0 6px" }} />
          <button
            onClick={() => { setAberto(false); navigate("/configuracoes"); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, fontSize: 13, color: "var(--ink-soft)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
          >
            <Settings size={16} strokeWidth={2} /> Configurações
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, fontSize: 13, color: "var(--ink-soft)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
          >
            <LogOut size={16} strokeWidth={2} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

const ABAS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/receitas-despesas", label: "Receitas/Despesas", icon: ArrowLeftRight },
  { path: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { path: "/importar", label: "Importar", icon: FileText },
  { path: "/cartao", label: "Cartão", icon: CreditCard },
  { path: "/notas", label: "Notas/MEI", icon: FileText },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/forecast", label: "Forecast", icon: LineChart },
  { path: "/planner", label: "Planner", icon: Target },
];

function Sidebar() {
  const location = useLocation();
  const { aberta, fechar } = useContext(SidebarCtx);
  return (
    <aside className={`app-sidebar${aberta ? " aberta" : ""}`} style={{ background: "var(--sidebar-bg)", color: "var(--sidebar-ink)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "22px 20px", borderBottom: "1px solid var(--sidebar-rule)" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: 0.3, textDecoration: "none", cursor: "pointer" }}>
          <img src={logoFinancas} alt="" style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }} />
          SANKORE <span style={{ color: "var(--sidebar-active)" }}>FINANÇAS</span>
        </a>
      </div>

      <nav style={{ flex: 1, padding: "12px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {ABAS.map((a) => {
          const ativo = location.pathname === a.path;
          const Icon = a.icon;
          return (
            <Link
              key={a.path}
              to={a.path}
              onClick={fechar}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8,
                color: ativo ? "#fff" : "var(--sidebar-ink)",
                background: ativo ? "var(--sidebar-active-bg)" : "transparent",
                fontSize: 13.5, fontWeight: ativo ? 600 : 400, textDecoration: "none",
                borderLeft: ativo ? "3px solid var(--sidebar-active)" : "3px solid transparent",
              }}
            >
              <Icon size={17} strokeWidth={2} />
              {a.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ margin: "10px 12px 20px", paddingTop: 16, borderTop: "1px solid var(--sidebar-rule)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <img src={logoLabs} alt="Sankoré Labs" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        <span style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--sidebar-ink-faint)" }}>by Sankoré Labs</span>
      </div>
    </aside>
  );
}

export function Topbar({ titulo, subtitulo }) {
  const { abrir } = useContext(SidebarCtx);
  const location = useLocation();
  const navigate = useNavigate();
  const mostrarVoltar = location.pathname !== "/";
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 28px", borderBottom: "1px solid var(--rule)", background: "var(--panel)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="hamburger-btn" onClick={abrir} aria-label="Abrir menu" style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "var(--ink)" }}>
          <Menu size={22} strokeWidth={2} />
        </button>
        {mostrarVoltar && (
          <button onClick={() => navigate(-1)} aria-label="Voltar" title="Voltar" style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "var(--ink)", display: "flex" }}>
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
        )}
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "var(--ink)" }}>{titulo}</h1>
          {subtitulo && <p style={{ fontSize: 13, color: "var(--ink-faint)", margin: "2px 0 0" }}>{subtitulo}</p>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Bell size={18} color="var(--ink-faint)" />
        <AccountMenu />
      </div>
    </header>
  );
}

export function Shell({ children }) {
  const [aberta, setAberta] = useState(false);
  return (
    <SidebarCtx.Provider value={{ aberta, abrir: () => setAberta(true), fechar: () => setAberta(false) }}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        {aberta && <div className="sidebar-backdrop aberta" onClick={() => setAberta(false)} />}
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    </SidebarCtx.Provider>
  );
}
