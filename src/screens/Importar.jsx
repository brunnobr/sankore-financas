import { useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { FONTES, parseArquivo } from "../lib/import/index.js";
import { loadRegrasUsuario, salvarRegraCategorizacao, importarTransacoes, registrarImportLog, loadImportLog } from "../data/transactions.js";
import { getCategoriasMap, getPalavrasCategoria } from "../data/settings.js";
import { normalizar, brl, formatarDataBR } from "../lib/finance/format.js";
import { Panel } from "./shared/ui.jsx";

export default function Importar() {
  const [fonteId, setFonteId] = useState(FONTES[0].id);
  const [categoriasMap, setCategoriasMap] = useState(null);
  const [palavrasCategoria, setPalavrasCategoria] = useState(null);
  const [linhas, setLinhas] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);
  const [log, setLog] = useState(null);

  useEffect(() => {
    Promise.all([getCategoriasMap(), getPalavrasCategoria()]).then(([c, p]) => {
      setCategoriasMap(c);
      setPalavrasCategoria(p);
    });
    carregarLog();
  }, []);

  function carregarLog() {
    loadImportLog().then(setLog).catch(() => setLog([]));
  }

  const categoriasDisponiveis = categoriasMap ? Object.keys(categoriasMap) : [];

  async function onArquivo(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErro("");
    setResultado(null);
    setCarregando(true);
    try {
      const regras = await loadRegrasUsuario();
      const parsed = await parseArquivo(file, fonteId, palavrasCategoria, regras);
      setLinhas(parsed.map((t) => ({ ...t, incluir: true, sempreAssim: false })));
      setNomeArquivo(file.name);
    } catch (e2) {
      setErro(`Não consegui ler esse arquivo: ${e2.message}`);
      setLinhas(null);
    } finally {
      setCarregando(false);
    }
  }

  function atualizarLinha(i, campo, valor) {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }

  async function confirmar() {
    setCarregando(true);
    setErro("");
    try {
      const incluidas = linhas.filter((l) => l.incluir);
      await Promise.all(
        incluidas.filter((l) => l.sempreAssim).map((l) => salvarRegraCategorizacao(normalizar(l.desc), l.cat))
      );
      const banco = FONTES.find((f) => f.id === fonteId).banco;
      const r = await importarTransacoes(incluidas, banco);
      const datas = incluidas.map((l) => l.data).sort();
      await registrarImportLog({
        banco,
        arquivoNome: nomeArquivo,
        competenciaInicio: datas[0],
        competenciaFim: datas[datas.length - 1],
        importadas: r.importadas,
        duplicadas: r.duplicadas,
      });
      setResultado(r);
      setLinhas(null);
      carregarLog();
    } catch (e2) {
      setErro(`Erro ao importar: ${e2.message}`);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
      <p style={{ color: "var(--ink-faint)", fontSize: 13, margin: 0 }}>Nada é gravado antes de você revisar e confirmar abaixo.</p>

      {log && log.length > 0 && (
        <Panel title="Extratos já importados">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)", color: "var(--ink-faint)" }}>
                <th style={{ padding: "6px 4px" }}></th>
                <th style={{ padding: "6px 4px" }}>Banco</th>
                <th style={{ padding: "6px 4px" }}>Arquivo</th>
                <th style={{ padding: "6px 4px" }}>Período</th>
                <th style={{ padding: "6px 4px" }}>Importado em</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Transações</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                  <td style={{ padding: "8px 4px" }}><FileCheck2 size={15} color="var(--credit)" /></td>
                  <td style={{ padding: "8px 4px" }}>{l.banco}</td>
                  <td style={{ padding: "8px 4px", color: "var(--ink-faint)" }}>{l.arquivo_nome}</td>
                  <td style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>
                    {l.competencia_inicio ? formatarDataBR(l.competencia_inicio) : "—"} a {l.competencia_fim ? formatarDataBR(l.competencia_fim) : "—"}
                  </td>
                  <td style={{ padding: "8px 4px", color: "var(--ink-faint)", whiteSpace: "nowrap" }}>{formatarDataBR(l.created_at.slice(0, 10))}</td>
                  <td style={{ padding: "8px 4px", textAlign: "right" }}>{l.transacoes_importadas}{l.transacoes_duplicadas > 0 && <span style={{ color: "var(--ink-faint)" }}> (+{l.transacoes_duplicadas} já existiam)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select value={fonteId} onChange={(e) => setFonteId(e.target.value)} style={{ padding: 8, border: "1px solid var(--rule)", borderRadius: 8 }}>
            {FONTES.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <input type="file" accept={FONTES.find((f) => f.id === fonteId)?.extensao} onChange={onArquivo} disabled={carregando} />
        </div>

        {erro && <p style={{ color: "var(--debit)", marginBottom: 0 }}>{erro}</p>}
        {carregando && <p style={{ color: "var(--ink-faint)", marginBottom: 0 }}>Processando…</p>}

        {resultado && (
          <div style={{ marginTop: 16, background: "var(--bg)", border: "1px solid var(--rule)", borderRadius: 8, padding: 16 }}>
            <strong style={{ color: "var(--credit)" }}>{resultado.importadas}</strong> transação(ões) importada(s).
            {resultado.duplicadas > 0 && <span style={{ color: "var(--ink-faint)" }}> {resultado.duplicadas} já existia(m) e foram ignoradas.</span>}
          </div>
        )}
      </Panel>

      {linhas && (
        <Panel title={`${linhas.length} linha(s) encontrada(s)`}>
          <p style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: -8, marginBottom: 12 }}>
            Desmarque o que não deve entrar, corrija a categoria onde fizer sentido, e confirme.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--rule)", color: "var(--ink-faint)" }}>
                  <th style={{ padding: "6px 4px" }}></th>
                  <th style={{ padding: "6px 4px" }}>Data</th>
                  <th style={{ padding: "6px 4px" }}>Descrição</th>
                  <th style={{ padding: "6px 4px" }}>Categoria</th>
                  <th style={{ padding: "6px 4px", textAlign: "right" }}>Valor</th>
                  <th style={{ padding: "6px 4px" }}>Sempre assim</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--rule)", opacity: l.incluir ? 1 : 0.4 }}>
                    <td style={{ padding: "8px 4px" }}>
                      <input type="checkbox" checked={l.incluir} onChange={(e) => atualizarLinha(i, "incluir", e.target.checked)} />
                    </td>
                    <td style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>{formatarDataBR(l.data)}</td>
                    <td style={{ padding: "8px 4px" }}>{l.desc}</td>
                    <td style={{ padding: "8px 4px" }}>
                      <select value={l.cat} onChange={(e) => atualizarLinha(i, "cat", e.target.value)} style={{ padding: 4, border: "1px solid var(--rule)", borderRadius: 6 }}>
                        {categoriasDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "8px 4px", textAlign: "right", color: l.valor >= 0 ? "var(--credit)" : "var(--debit)", whiteSpace: "nowrap" }}>{brl(l.valor)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "center" }}>
                      <input type="checkbox" checked={l.sempreAssim} onChange={(e) => atualizarLinha(i, "sempreAssim", e.target.checked)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={confirmar}
            disabled={carregando || !linhas.some((l) => l.incluir)}
            style={{ marginTop: 16, padding: "10px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
          >
            Confirmar e importar {linhas.filter((l) => l.incluir).length} transação(ões)
          </button>
        </Panel>
      )}
    </div>
  );
}
