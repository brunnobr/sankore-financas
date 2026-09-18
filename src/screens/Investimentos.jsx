import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
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

// Clareia/escurece uma cor hex (#rrggbb) para simular o brilho de uma peça
// de plástico (gradiente radial: claro no canto, cor real na borda).
function ajustarCor(hex, pct) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) + Math.round(255 * pct)));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + Math.round(255 * pct)));
  const b = Math.min(255, Math.max(0, (n & 255) + Math.round(255 * pct)));
  return `rgb(${r}, ${g}, ${b})`;
}

// Defs de gradiente radial (um por fatia) + filtro de sombra — dá o efeito
// de peça de plástico brilhante em vez de uma fatia lisa.
function RoscaDefs({ dados, idKey, idPrefix }) {
  return (
    <defs>
      {dados.map((d) => (
        <radialGradient key={d[idKey]} id={`${idPrefix}-${d[idKey]}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={ajustarCor(d.cor, 0.35)} />
          <stop offset="55%" stopColor={d.cor} />
          <stop offset="100%" stopColor={ajustarCor(d.cor, -0.15)} />
        </radialGradient>
      ))}
      <filter id="rosca-sombra" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.35" />
      </filter>
    </defs>
  );
}

function LegendaComposicao({ dados, total, idKey }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, minWidth: 160 }}>
      <div>
        <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>Total investido</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{brl(total)}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {dados.map((d) => (
          <div key={d[idKey]} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: d.cor, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{d.label}</span>
            <span style={{ color: "var(--ink-faint)", fontVariantNumeric: "tabular-nums" }}>{pct(d.pct, 1)}</span>
            <span style={{ fontWeight: 600, minWidth: 78, textAlign: "right" }}>{brl(d.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <ResponsiveContainer width="100%" height={220} style={{ flex: 2, minWidth: 200 }}>
              <PieChart>
                <RoscaDefs dados={grupos} idKey="grupo" idPrefix="grad-fn" />
                <Pie data={grupos} dataKey="valor" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={4} cornerRadius={8} filter="url(#rosca-sombra)" stroke="none">
                  {grupos.map((g) => <Cell key={g.grupo} fill={`url(#grad-fn-${g.grupo})`} />)}
                </Pie>
                <Tooltip formatter={(v) => brl(v)} />
              </PieChart>
            </ResponsiveContainer>
            <LegendaComposicao dados={grupos} total={investido(assetGroupMap, latest)} idKey="grupo" />
          </div>
        </Panel>
        <Panel title="Composição por tipo" style={{ flex: 1, minWidth: 300 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <ResponsiveContainer width="100%" height={220} style={{ flex: 2, minWidth: 200 }}>
              <PieChart>
                <RoscaDefs dados={tipos} idKey="tipo" idPrefix="grad-tp" />
                <Pie data={tipos} dataKey="valor" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={4} cornerRadius={8} filter="url(#rosca-sombra)" stroke="none">
                  {tipos.map((t) => <Cell key={t.tipo} fill={`url(#grad-tp-${t.tipo})`} />)}
                </Pie>
                <Tooltip formatter={(v) => brl(v)} />
              </PieChart>
            </ResponsiveContainer>
            <LegendaComposicao dados={tipos} total={totalDoMes(latest)} idKey="tipo" />
          </div>
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
