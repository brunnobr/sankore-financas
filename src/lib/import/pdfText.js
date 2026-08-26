/* Extração de texto de PDF no navegador, via pdfjs-dist.
   Reconstrói linhas agrupando os itens de texto por posição Y (mesma
   ideia do `pdftotext -layout`) — necessário porque a ordem "natural"
   dos itens no PDF não bate com a ordem visual em relatórios de
   colunas fixas (extratos bancários). Testado contra os PDFs reais do
   Banrisul e Mercado Pago antes de escrever os parsers. */
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extrairLinhasPdf(file) {
  const buf = await file.arrayBuffer();
  const doc = await getDocument({ data: buf }).promise;
  const linhas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const porY = new Map();
    for (const item of content.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      if (!porY.has(y)) porY.set(y, []);
      porY.get(y).push({ x, str: item.str });
    }
    const ys = [...porY.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const linha = porY.get(y).sort((a, b) => a.x - b.x).map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
      if (linha) linhas.push(linha);
    }
  }
  return linhas;
}
