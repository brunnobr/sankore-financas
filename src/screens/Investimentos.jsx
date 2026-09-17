import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import { Landmark, PiggyBank, Wallet, Percent } from "lucide-react";
import { loadMonths } from "../data/investments.js";
import { getAssetGroupMap, getAssetTipoMap, updateSetting } from "../data/settings.js";
import { GRUPO, TIPO } from "../lib/finance/taxonomy.js";
import {
  gruposDoMes, tiposDoMes, retornoMes, retornosPorAtivo, totalDoMes, investido, caixaDoMes,
} from "../lib/finance/returns.js";
import { brl, pct, labelMes } from "../lib/finance/format.js";
import { Panel, StatCard } from "./shared/ui.jsx";

const selectStyle = { padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 13, background: "var(--panel)" };

/* Classificação de cada ativo por função (onde entra o aporte, ver
   GRUPO) e tipo (composição da carteira, ver TIPO). Sem isso, um ativo
   novo cai silenciosamente em "Congelado"/"Bond estruturado (USD)" —
   aqui é onde você identifica de verdade cada investimento. */
function GerenciarAtivos({ tickers, assetGroupMap, assetTipoMap, onAtualizado }) {
  const [salvando, setSalvando] = useState(null);

  async function alterar(chave, ticker, valor, mapaAtual) {
    setSalvando(ticker);
    const novo = { ...mapaAtual, [ticker]: valor };
    try {
      await updateSetting(chave, novo);
      onAtualizado(chave, novo);
    } finally {
      setSalvando(null);
    }
  }

  if (!tickers.length) return null;

  return (
    <Panel title="Meus ativos">
      <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: -8, marginBottom: 12 }}>
        Classifique cada ativo por função (onde entra o aporte novo) e tipo (composição da carteira).
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)", color: "var(--ink-faint)" }}>
              <th style={{ padding: "6px 4px" }}>Ativo</th>
              <th style={{ padding: "6px 4px" }}>Função</th>
              <th style={{ padding: "6px 4px" }}>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {tickers.map((t) => (
              <tr key={t} style={{ borderBottom: "1px solid var(--rule)", opacity: salvando === t ? 0.6 : 1 }}>
                <td style={{ padding: "8px 4px" }}>{t}</td>
                <td style={{ padding: "8px 4px" }}>
                  <select
                    value={assetGroupMap[t] || ""}
                    disabled={salvando === t}
                    onChange={(e) => alterar("asset_group", t, e.target.value, assetGroupMap)}
                    style={selectStyle}
                  >
                    <option value="" disabled>— classificar —</option>
                    {Object.entries(GRUPO).map(([g, info]) => <option key={g} value={g}>{info.label}</option>)}
                  </select>
                </td>
                <td style={{ padding: "8px 4px" }}>
                  <select
                    value={assetTipoMap[t] || ""}
                    disabled={salvando === t}
                    onChange={(e) => alterar("asset_tipo", t, e.target.value, assetTipoMap)}
                    style={selectStyle}
                  >
                    <option value="" disabled>— classificar —</option>
                    {Object.entries(TIPO).map(([ti, info]) => <option key={ti} value={ti}>{info.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function Investimentos() {
  const [months, setMonths] = useState(null);
  const [assetGroupMap, setAssetGroupMap] = useState(null);
  const [assetTipoMap, setAssetTipoMap] = useState(null);
  const [erro, setErro] = useState("");
  const [mesIndex, setMesIndex] = useState(null); // índice em `months`; null = último
  const [filtroGrupo, setFiltroGrupo] = useState("TODOS");
  const [tipoGrafico, setTipoGrafico] = useState("linha"); // linha | barra | area

  async function carregar() {
    try {
      const [ms, g, t] = await Promise.all([loadMonths(), getAssetGroupMap(), getAssetTipoMap()]);
      setMonths(ms);
      setAssetGroupMap(g);
      setAssetTipoMap(t);
    } catch (e) {
      setErro(e.message || "Erro ao carregar dados de investimentos.");
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const pronto = months && assetGroupMap && assetTipoMap;

  const idxSelecionado = pronto && months.length ? (mesIndex ?? months.length - 1) : null;
  const latest = pronto && idxSelecionado != null ? months[idxSelecionado] : null;
  const prev = pronto && idxSelecionado != null && idxSelecionado > 0 ? months[idxSelecionado - 1] : null;

  const grupos = pronto && latest ? gruposDoMes(assetGroupMap, latest) : [];
  const tipos = pronto && latest ? tiposDoMes(assetTipoMap, latest) : [];
  const linhasTodas = pronto && latest ? retornosPorAtivo(assetGroupMap, prev, latest) : [];
  const linhas = filtroGrupo === "TODOS" ? linhasTodas : linhasTodas.filter((l) => l.grupo === filtroGrupo);
  const retorno = pronto && latest ? retornoMes(assetGroupMap, prev, latest) : null;

  const evolucao = useMemo(() => {
    if (!pronto) return [];
    return months.map((m) => ({
      mes: labelMes(m.key).slice(0, 3),
      investido: investido(assetGroupMap, m),
    }));
  }, [pronto, months, assetGroupMap]);

  const tickers = useMemo(() => {
    if (!pronto) return [];
    return [...new Set(months.flatMap((m) => m.assets.map((a) => a.nome)))].sort();
  }, [pronto, months]);

  function onAtualizadoClassificacao(chave, novo) {
    if (chave === "asset_group") setAssetGroupMap(novo);
    else setAssetTipoMap(novo);
  }

  if (erro) return <p style={{ color: "var(--debit)" }}>{erro}</p>;
  if (!pronto) return <p style={{ color: "var(--ink-faint)" }}>Carregando…</p>;
  if (!months.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Panel><p style={{ color: "var(--ink-faint)", margin: 0 }}>Nenhum fechamento de mês cadastrado ainda — registre um saldo em Importar.</p></Panel>
        <GerenciarAtivos tickers={tickers} assetGroupMap={assetGroupMap} assetTipoMap={assetTipoMap} onAtualizado={onAtualizadoClassificacao} />
      </div>
    );
  }

  const patrimonioTotal = totalDoMes(latest);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <p style={{ color: "var(--ink-faint)", fontSize: 13, margin: 0 }}>Fechamento de</p>
        <select value={idxSelecionado} onChange={(e) => setMesIndex(Number(e.target.value))} style={selectStyle}>
          {months.map((m, i) => <option key={m.key} value={i}>{labelMes(m.key)}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-faint)" }}>Filtrar por grupo:</span>
        <select value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)} style={selectStyle}>
          <option value="TODOS">Todos</option>
          {Object.entries(GRUPO).map(([g, info]) => <option key={g} value={g}>{info.label}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard icon={Landmark} cor="green" rotulo="Patrimônio total" valor={brl(patrimonioTotal)} />
        <StatCard icon={PiggyBank} cor="purple" rotulo="Investido" valor={brl(investido(assetGroupMap, latest))} />
        <StatCard icon={Wallet} cor="blue" rotulo="Caixa" valor={brl(caixaDoMes(assetGroupMap, latest))} />
        {retorno && (
          <StatCard
            icon={Percent}
            cor={retorno.pct >= 0 ? "green" : "red"}
            rotulo={`Retorno vs ${labelMes(prev.key)}`}
            valor={pct(retorno.pct)}
            sub={retorno.xirr ? "XIRR" : "retorno simples"}
          />
        )}
      </div>

      <Panel title="Evolução patrimonial">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <select value={tipoGrafico} onChange={(e) => setTipoGrafico(e.target.value)} style={selectStyle}>
            <option value="linha">Linha</option>
            <option value="barra">Barra</option>
            <option value="area">Área</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          {tipoGrafico === "barra" ? (
            <BarChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
              <XAxis dataKey="mes" stroke="var(--ink-faint)" fontSize={12} />
              <YAxis stroke="var(--ink-faint)" fontSize={12} tickFormatter={(v) => brl(v)} width={90} />
              <Tooltip formatter={(v) => brl(v)} />
              <Bar dataKey="investido" name="Investido" fill="var(--credit)" />
            </BarChart>
          ) : tipoGrafico === "area" ? (
            <AreaChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
              <XAxis dataKey="mes" stroke="var(--ink-faint)" fontSize={12} />
              <YAxis stroke="var(--ink-faint)" fontSize={12} tickFormatter={(v) => brl(v)} width={90} />
              <Tooltip formatter={(v) => brl(v)} />
              <Area type="monotone" dataKey="investido" name="Investido" stroke="var(--credit)" fill="var(--credit)" fillOpacity={0.15} />
            </AreaChart>
          ) : (
            <LineChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
              <XAxis dataKey="mes" stroke="var(--ink-faint)" fontSize={12} />
              <YAxis stroke="var(--ink-faint)" fontSize={12} tickFormatter={(v) => brl(v)} width={90} />
              <Tooltip formatter={(v) => brl(v)} />
              <Line type="monotone" dataKey="investido" name="Investido" stroke="var(--credit)" strokeWidth={2} dot />
            </LineChart>
          )}
        </ResponsiveContainer>
      </Panel>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <Panel title="Composição por função" style={{ flex: 1, minWidth: 300 }}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={grupos} dataKey="valor" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {grupos.map((g) => <Cell key={g.grupo} fill={g.cor} />)}
              </Pie>
              <Tooltip formatter={(v) => brl(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Composição por tipo" style={{ flex: 1, minWidth: 300 }}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={tipos} dataKey="valor" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {tipos.map((t) => <Cell key={t.tipo} fill={t.cor} />)}
              </Pie>
              <Tooltip formatter={(v) => brl(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title={`Retorno por ativo (vs ${prev ? labelMes(prev.key) : "—"})`}>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)", color: "var(--ink-faint)" }}>
              <th style={{ padding: "6px 4px" }}>Ativo</th>
              <th style={{ padding: "6px 4px" }}>Grupo</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Valor</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Retorno</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.nome} style={{ borderBottom: "1px solid var(--rule)" }}>
                <td style={{ padding: "8px 4px" }}>{l.nome}</td>
                <td style={{ padding: "8px 4px", color: "var(--ink-faint)" }}>{GRUPO[l.grupo]?.label || l.grupo}</td>
                <td style={{ padding: "8px 4px", textAlign: "right" }}>{brl(l.valor)}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", color: l.rendPct == null ? "var(--ink-faint)" : l.rendPct >= 0 ? "var(--credit)" : "var(--debit)" }}>
                  {l.rendPct == null ? "—" : pct(l.rendPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Panel>

      <GerenciarAtivos tickers={tickers} assetGroupMap={assetGroupMap} assetTipoMap={assetTipoMap} onAtualizado={onAtualizadoClassificacao} />
    </div>
  );
}
