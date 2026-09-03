import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import { Landmark, PiggyBank, Wallet, Percent, Sparkles } from "lucide-react";
import { loadMonths, salvarSnapshotAtivo, extrairSaldosDePrint } from "../data/investments.js";
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

/* Ativo sem extrato baixável (Banco Inter, cripto, cofrinhos...): o
   usuário lê o saldo de um print e registra aqui — upsert por mês, então
   reenviar o mesmo mês só corrige o valor. */
function AtualizarSaldoForm({ tickers, onSalvo }) {
  const hoje = new Date().toISOString().slice(0, 7);
  const [ticker, setTicker] = useState("");
  const [mes, setMes] = useState(hoje);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (!ticker.trim() || !mes || valor === "") return;
    setSalvando(true);
    setErro("");
    try {
      await salvarSnapshotAtivo({ ticker: ticker.trim(), mes: `${mes}-01`, valor: Number(valor) });
      setTicker("");
      setValor("");
      onSalvo();
    } catch (e2) {
      setErro(e2.message || "Erro ao salvar saldo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Panel title="Atualizar saldo manualmente">
      <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: -8, marginBottom: 12 }}>
        Para ativos sem extrato baixável (ex: investimentos do Banco Inter) — registra o fechamento do mês a partir do que você vê no app/print.
      </p>
      <form onSubmit={onSubmit} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Ativo</label>
          <input list="tickers-existentes" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="ex: INTER FIRF" style={{ padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6, minWidth: 180 }} />
          <datalist id="tickers-existentes">
            {tickers.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Mês</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Saldo (R$)</label>
          <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" style={{ padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6, width: 140 }} />
        </div>
        <button type="submit" disabled={salvando} style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </form>
      {erro && <p style={{ color: "var(--debit)", marginBottom: 0, marginTop: 8 }}>{erro}</p>}
    </Panel>
  );
}

function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Importa saldos por print da tela do banco — sobe 1+ capturas, a Edge
   Function chama a API da Claude e devolve os pares ativo/valor, que
   caem numa fila de revisão (igual ao import de extrato) antes de
   gravar em asset_snapshots. */
function ImportarPrintForm({ tickers, onSalvo }) {
  const hoje = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(hoje);
  const [extraindo, setExtraindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");

  async function onArquivos(e) {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    setErro("");
    setItens(null);
    setExtraindo(true);
    try {
      const imagens = await Promise.all(files.map(async (f) => ({ data: await fileParaBase64(f), mediaType: f.type || "image/jpeg" })));
      const extraidos = await extrairSaldosDePrint(imagens);
      if (!extraidos.length) { setErro("Não consegui reconhecer nenhum ativo nesses prints."); return; }
      setItens(extraidos.map((it) => ({ ...it, incluir: true })));
    } catch (e2) {
      setErro(e2.message || "Erro ao extrair os saldos.");
    } finally {
      setExtraindo(false);
    }
  }

  function atualizarItem(i, campo, valor) {
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }

  async function confirmar() {
    setSalvando(true);
    setErro("");
    try {
      const incluidos = itens.filter((it) => it.incluir);
      await Promise.all(incluidos.map((it) => salvarSnapshotAtivo({ ticker: it.nome.trim(), mes: `${mes}-01`, valor: Number(it.valor) })));
      setItens(null);
      onSalvo();
    } catch (e2) {
      setErro(e2.message || "Erro ao salvar os saldos.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Panel title="Importar por print">
      <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: -8, marginBottom: 12 }}>
        Sobe uma ou mais capturas de tela do app do banco — a IA lê os ativos e saldos, você confere e confirma antes de gravar.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Mês do fechamento</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--rule)", borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "var(--ink-faint)" }}>Prints</label>
          <input type="file" accept="image/*" multiple onChange={onArquivos} disabled={extraindo || salvando} />
        </div>
        {extraindo && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-faint)" }}>
            <Sparkles size={14} strokeWidth={2} /> Lendo os prints…
          </span>
        )}
      </div>

      {erro && <p style={{ color: "var(--debit)", marginTop: 12, marginBottom: 0 }}>{erro}</p>}

      {itens && itens.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)", color: "var(--ink-faint)" }}>
                  <th style={{ padding: "6px 4px" }}></th>
                  <th style={{ padding: "6px 4px" }}>Ativo</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--rule)", opacity: it.incluir ? 1 : 0.4 }}>
                    <td style={{ padding: "8px 4px" }}>
                      <input type="checkbox" checked={it.incluir} onChange={(e) => atualizarItem(i, "incluir", e.target.checked)} />
                    </td>
                    <td style={{ padding: "8px 4px" }}>
                      <input list="tickers-existentes-print" value={it.nome} onChange={(e) => atualizarItem(i, "nome", e.target.value)} style={{ padding: "4px 8px", border: "1px solid var(--rule)", borderRadius: 6, minWidth: 180 }} />
                    </td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>
                      <input type="number" step="0.01" value={it.valor} onChange={(e) => atualizarItem(i, "valor", e.target.value)} style={{ padding: "4px 8px", border: "1px solid var(--rule)", borderRadius: 6, width: 120, textAlign: "right" }} />
                      {it.moeda === "USD" && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--debit)" }}>USD — converta pra R$</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="tickers-existentes-print">
            {tickers.map((t) => <option key={t} value={t} />)}
          </datalist>
          <button
            onClick={confirmar}
            disabled={salvando || !itens.some((it) => it.incluir)}
            style={{ marginTop: 16, padding: "10px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
          >
            {salvando ? "Salvando…" : `Confirmar e gravar ${itens.filter((it) => it.incluir).length} ativo(s)`}
          </button>
        </div>
      )}
    </Panel>
  );
}

export default function Investimentos() {
  const [months, setMonths] = useState(null);
  const [assetGroupMap, setAssetGroupMap] = useState(null);
  const [assetTipoMap, setAssetTipoMap] = useState(null);
  const [erro, setErro] = useState("");

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
  if (!latest) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Panel><p style={{ color: "var(--ink-faint)", margin: 0 }}>Nenhum fechamento de mês cadastrado ainda.</p></Panel>
        <GerenciarAtivos tickers={tickers} assetGroupMap={assetGroupMap} assetTipoMap={assetTipoMap} onAtualizado={onAtualizadoClassificacao} />
        <ImportarPrintForm tickers={tickers} onSalvo={carregar} />
        <AtualizarSaldoForm tickers={tickers} onSalvo={carregar} />
      </div>
    );
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
                <td style={{ padding: "8px 4px", color: "var(--ink-faint)" }}>{l.grupo}</td>
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

      <ImportarPrintForm tickers={tickers} onSalvo={carregar} />
      <AtualizarSaldoForm tickers={tickers} onSalvo={carregar} />
    </div>
  );
}
