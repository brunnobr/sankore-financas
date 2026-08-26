/* Parser de extrato OFX (Open Financial Exchange) — formato usado pelo
   Banco Inter (PF e PJ) e, em tese, por qualquer banco que exporte OFX.
   OFX é SGML tolerante (nem sempre tem tag de fechamento), então a
   extração é por regex tag-a-tag dentro de cada bloco <STMTTRN>...
   </STMTTRN>, sem exigir XML bem formado. */

function pegarTag(bloco, tag) {
  const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : "";
}

function limparMemo(memo) {
  // "Pix recebido: \"Cp :92702067-BRUNNO...\"" -> "Pix recebido: Cp :92702067-BRUNNO..."
  return memo.replace(/"/g, "").trim();
}

export function parseOFX(texto) {
  const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  return blocos.map((bloco) => {
    const dtposted = pegarTag(bloco, "DTPOSTED"); // YYYYMMDD[hhmmss...]
    const data = `${dtposted.slice(0, 4)}-${dtposted.slice(4, 6)}-${dtposted.slice(6, 8)}`;
    const valor = parseFloat(pegarTag(bloco, "TRNAMT"));
    const memo = limparMemo(pegarTag(bloco, "MEMO") || pegarTag(bloco, "NAME"));
    const fitid = pegarTag(bloco, "FITID");
    return { data, desc: memo, valor, fitid };
  }).filter((t) => t.data.length === 10 && !Number.isNaN(t.valor));
}
