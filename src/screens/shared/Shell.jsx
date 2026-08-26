import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, TrendingUp, ArrowLeftRight, CreditCard, FileText,
  BarChart3, LineChart, Target, LogOut, Bell,
} from "lucide-react";
import { supabase } from "../../data/supabaseClient.js";
import { useAuth } from "../../data/AuthContext.jsx";

function iniciais(nome) {
  return nome.trim().slice(0, 2).toUpperCase();
}

function UserBadge() {
  const { session } = useAuth();
  const user = session?.user;
  if (!user) return null;
  const nome = user.user_metadata?.full_name || user.email;
  const foto = user.user_metadata?.avatar_url;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 12px 8px", padding: "10px 8px", borderRadius: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {foto ? (
        <img src={foto} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--sidebar-active-bg)", color: "var(--sidebar-active)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {iniciais(nome)}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</div>
        <div style={{ fontSize: 11, color: "var(--sidebar-ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
      </div>
    </div>
  );
}

const ABAS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { path: "/receitas-despesas", label: "Receitas/Despesas", icon: ArrowLeftRight },
  { path: "/importar", label: "Importar", icon: FileText },
  { path: "/cartao", label: "Cartão", icon: CreditCard },
  { path: "/notas", label: "Notas/MEI", icon: FileText },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/forecast", label: "Forecast", icon: LineChart },
  { path: "/planner", label: "Planner", icon: Target },
];

function Sidebar() {
  const location = useLocation();
  return (
    <aside style={{ width: 232, background: "var(--sidebar-bg)", color: "var(--sidebar-ink)", display: "flex", flexDirection: "column", flexShrink: 0, height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ padding: "22px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: 0.3 }}>
          SANKORE <span style={{ color: "var(--sidebar-active)" }}>FINANÇAS</span>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {ABAS.map((a) => {
          const ativo = location.pathname === a.path;
          const Icon = a.icon;
          return (
            <Link
              key={a.path}
              to={a.path}
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

      <UserBadge />

      <button
        onClick={() => supabase.auth.signOut()}
        style={{ margin: 12, padding: "9px 12px", background: "transparent", border: "none", color: "var(--sidebar-ink-faint)", display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, cursor: "pointer", borderRadius: 8 }}
      >
        <LogOut size={17} strokeWidth={2} /> Sair
      </button>
    </aside>
  );
}

export function Topbar({ titulo, subtitulo }) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 28px", borderBottom: "1px solid var(--rule)", background: "var(--panel)" }}>
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "var(--ink)" }}>{titulo}</h1>
        {subtitulo && <p style={{ fontSize: 13, color: "var(--ink-faint)", margin: "2px 0 0" }}>{subtitulo}</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Bell size={18} color="var(--ink-faint)" />
      </div>
    </header>
  );
}

export function Shell({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
