import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./data/AuthContext.jsx";
import { Shell, Topbar } from "./screens/shared/Shell.jsx";
import { Panel } from "./screens/shared/ui.jsx";
import Login from "./screens/Login.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import Investimentos from "./screens/Investimentos.jsx";
import ReceitasDespesas from "./screens/ReceitasDespesas.jsx";
import Importar from "./screens/Importar.jsx";

const TITULOS = {
  "/": "Dashboard",
  "/investimentos": "Investimentos",
  "/receitas-despesas": "Receitas/Despesas",
  "/importar": "Importar extrato",
  "/cartao": "Cartão",
  "/notas": "Notas/MEI",
  "/analytics": "Analytics",
  "/forecast": "Forecast",
  "/planner": "Planner",
};

function Placeholder({ titulo }) {
  return (
    <div style={{ padding: 28 }}>
      <Topbar titulo={titulo} />
      <div style={{ padding: 28 }}>
        <Panel><p style={{ color: "var(--ink-faint)", margin: 0 }}>Em construção — chega nas próximas fases.</p></Panel>
      </div>
    </div>
  );
}

function Pagina({ titulo, subtitulo, children }) {
  return (
    <div>
      <Topbar titulo={titulo} subtitulo={subtitulo} />
      <div style={{ padding: 28 }}>{children}</div>
    </div>
  );
}

function AppShell() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Pagina titulo={TITULOS["/"]}><Dashboard /></Pagina>} />
        <Route path="/investimentos" element={<Pagina titulo={TITULOS["/investimentos"]}><Investimentos /></Pagina>} />
        <Route path="/receitas-despesas" element={<Pagina titulo={TITULOS["/receitas-despesas"]}><ReceitasDespesas /></Pagina>} />
        <Route path="/importar" element={<Pagina titulo={TITULOS["/importar"]}><Importar /></Pagina>} />
        <Route path="/cartao" element={<Placeholder titulo="Cartão" />} />
        <Route path="/notas" element={<Placeholder titulo="Notas/MEI" />} />
        <Route path="/analytics" element={<Placeholder titulo="Analytics" />} />
        <Route path="/forecast" element={<Placeholder titulo="Forecast" />} />
        <Route path="/planner" element={<Placeholder titulo="Planner" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

function Gate() {
  const auth = useAuth();
  if (auth.session === undefined) return null; // carregando sessão
  if (!auth.session) return <Login />;
  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  );
}
