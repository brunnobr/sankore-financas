/* Ponto único de entrada da importação de extratos — escolhe o parser
   certo pela fonte selecionada pelo usuário no upload, filtra ruído
   interno, sugere categoria e calcula o hash de dedup. Cada linha
   resultante ainda passa pela fila de revisão antes de virar
   transação de verdade (ver src/screens/Importar.jsx). */
import { extrairLinhasPdf } from "./pdfText.js";
import { parseOFX } from "./parsers/ofx.js";
import { parseBanrisul } from "./parsers/banrisul.js";
import { parseMercadoPagoConta } from "./parsers/mercadoPagoConta.js";
import { filtrarRuido } from "./filtros.js";
import { categorizarPorPalavra, aplicarRegras, hashTransacao } from "../finance/categorization.js";

export const FONTES = [
  { id: "inter-ofx", label: "Banco Inter — extrato .ofx", banco: "Banco Inter", extensao: ".ofx" },
  { id: "banrisul-pdf", label: "Banrisul — extrato PDF", banco: "Banrisul", extensao: ".pdf" },
  { id: "mp-pdf", label: "Mercado Pago — extrato de conta PDF", banco: "Mercado Pago", extensao: ".pdf" },
];

async function parseBruto(file, fonteId) {
  if (fonteId === "inter-ofx") return parseOFX(await file.text());
  const linhas = await extrairLinhasPdf(file);
  if (fonteId === "banrisul-pdf") return parseBanrisul(linhas);
  if (fonteId === "mp-pdf") return parseMercadoPagoConta(linhas);
  throw new Error(`Fonte desconhecida: ${fonteId}`);
}

/* Retorna as transações prontas para a fila de revisão: já filtradas,
   categorizadas e com hash de dedup calculado. */
export async function parseArquivo(file, fonteId, palavrasCategoria, regrasUsuario) {
  const fonte = FONTES.find((f) => f.id === fonteId);
  if (!fonte) throw new Error(`Fonte desconhecida: ${fonteId}`);

  const brutas = filtrarRuido(await parseBruto(file, fonteId)).map((t) => ({ ...t, banco: fonte.banco }));
  const comCategoriaSugerida = aplicarRegras(
    brutas.map((t) => ({ ...t, cat: categorizarPorPalavra(t.desc, palavrasCategoria) })),
    regrasUsuario
  );

  return Promise.all(
    comCategoriaSugerida.map(async (t) => ({ ...t, hash: await hashTransacao(t) }))
  );
}
