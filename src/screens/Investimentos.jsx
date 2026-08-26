import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import { Landmark, PiggyBank, Wallet, Percent } from "lucide-react";
import { loadMonths } from "../data/investments.js";
import { getAssetGroupMap, getAssetTipoMap } from "../data/settings.js";
import {
  gruposDoMes, tiposDoMes, retornoMes, retornosPorAtivo, totalDoMes, investido, caixaDoMes,
} from "../lib/finance/returns.js";
import { brl, pct, labelMes } from "../lib/finance/format.js";
import { Panel, StatCard } from "./shared/ui.jsx";

export default function Investimentos() {
  const [months, setMonths] = useState(null);
  const [assetGroupMap, setAssetGroupMap] = useState(null);
  const [assetTipoMap, setAssetTipoMap] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [ms, g, t] = await Promise.all([loadMonths(), getAssetGroupMap(), getAssetTipoMap()]);
        setMonths(ms);
        setAssetGroupMap(g);
        setAssetTipoMap(t);
      } catch (e) {
        setErro(e.message || "Erro ao carregar dados de investimentos.");
      }
    })();
  }, []);

  const pronto = months && assetGroupMap && assetTipoMap;

  const latest = pronto && months.length ? months[months.length - 1] : null;
  const prev = pronto && months.length > 1 ? months[months.length - 2] : null;

  const grupos = pronto && latest ? gruposDoMes(assetGroupMap, latest) : [];
  const tipos = pronto && latest ? tiposDoMes(assetTipoMap, latest) : [];
  const linhas = pronto && latest ? retornosPorAtivo(assetGroupMap, prev, latest) : [];
  const retorno = pronto && latest ? retornoMes(assetGroupMap, prev, latest) : null;

  const evolucao = useMemo(() => {
    if (!pronto) return [];
    return months.map((m) => ({
      mes: labelMes(m.key).slice(0, 3),
      total: totalDoMes(m),
      investido: investido(assetGroupMap, m),
      caixa: caixaDoMes(assetGroupMap, m),
    }));
  }, [pronto, months, assetGroupMap]);

  if (erro) return <p style={{ color: "var(--debit)" }}>{erro}</p>;
  if (!pronto) return <p style={{ color: "var(--ink-faint)" }}>Carregando…</p>;
  if (!latest) {
    return <Panel><p style={{ color: "var(--ink-faint)", margin: 0 }}>Nenhum fechamento de mês cadastrado ainda.</p></Panel>;
  }

  const patrimonioTotal = totalDoMes(latest);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: "var(--ink-faint)", fontSize: 13, margin: 0 }}>Fechamento de {labelMes(latest.key)}</p>

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
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={evolucao}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
            <XAxis dataKey="mes" stroke="var(--ink-faint)" fontSize={12} />
            <YAxis stroke="var(--ink-faint)" fontSize={12} tickFormatter={(v) => brl(v)} width={90} />
            <Tooltip formatter={(v) => brl(v)} />
            <Legend />
            <Line type="monotone" dataKey="total" name="Total" stroke="var(--ink)" strokeWidth={2} dot />
            <Line type="monotone" dataKey="investido" name="Investido" stroke="var(--credit)" strokeWidth={2} dot />
            <Line type="monotone" dataKey="caixa" name="Caixa" stroke="var(--blue)" strokeWidth={1.5} dot />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <Panel title="Composição por função" style={{ flex: 1, minWidth: 300 }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={grupos} layout="vertical">
              <XAxis type="number" tickFormatter={(v) => brl(v)} stroke="var(--ink-faint)" fontSize={11} />
              <YAxis type="category" dataKey="label" width={100} stroke="var(--ink-faint)" fontSize={12} />
              <Tooltip formatter={(v) => brl(v)} />
              <Bar dataKey="valor">
                {grupos.map((g) => <Cell key={g.grupo} fill={g.cor} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Composição por tipo" style={{ flex: 1, minWidth: 300 }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tipos} layout="vertical">
              <XAxis type="number" tickFormatter={(v) => brl(v)} stroke="var(--ink-faint)" fontSize={11} />
              <YAxis type="category" dataKey="label" width={140} stroke="var(--ink-faint)" fontSize={12} />
              <Tooltip formatter={(v) => brl(v)} />
              <Bar dataKey="valor">
                {tipos.map((t) => <Cell key={t.tipo} fill={t.cor} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title={`Retorno por ativo (vs ${prev ? labelMes(prev.key) : "—"})`}>
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
                <td style={{ padding: "8px 4px", color: "var(--ink-faint)" }}>{l.grupo}</td>
                <td style={{ padding: "8px 4px", textAlign: "right" }}>{brl(l.valor)}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", color: l.rendPct == null ? "var(--ink-faint)" : l.rendPct >= 0 ? "var(--credit)" : "var(--debit)" }}>
                  {l.rendPct == null ? "—" : pct(l.rendPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
