/* Parser do extrato de conta em PDF do Mercado Pago. Espera as linhas
   já reconstruídas por posição Y (ver ../pdfText.js). A descrição pode
   vir de dois jeitos, às vezes no mesmo extrato: inline na própria
   linha da transação (quando curta), ou em linha(s) própria(s) antes
   dela (quando longa o bastante pra quebrar visualmente). Formato real
   (testado contra extratos de julho e agosto/2026):

     03-08-2026 Rendimentos 1747695248782 R$ 0,02 R$ 29,34    <- desc inline
     Pix recebido BRUNNO
     BARROS RIBEIRO
     10-08-2026 172090932625 R$ 729,69 R$ 759,16              <- desc nas linhas antes
*/
const LINHA_TRANSACAO_INLINE = /^(\d{2})-(\d{2})-(\d{4})\s+(.+?)\s+(\d{6,})\s+R\$\s*(-?[\d.,]+)\s+R\$\s*(-?[\d.,]+)$/;
const LINHA_TRANSACAO_SIMPLES = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{6,})\s+R\$\s*(-?[\d.,]+)\s+R\$\s*(-?[\d.,]+)$/;
const RUIDO = /^(Data|Descrição|ID da opera|Valor|Saldo|EXTRATO DE CONTA|DETALHE DOS MOVIMENTOS|Periodo:|Entradas:|Saidas:|Saldo inicial|Saldo final|CPF\/CNPJ|Data de gera|\d+\/\d+$)/i;

function parseValor(str) {
  return parseFloat(str.replace(/\./g, "").replace(",", "."));
}

export function parseMercadoPagoConta(linhas) {
  const transacoes = [];
  let pendenteDesc = [];

  for (const linha of linhas) {
    const inline = linha.match(LINHA_TRANSACAO_INLINE);
    if (inline) {
      const [, dia, mes, ano, desc, , valorStr] = inline;
      transacoes.push({ data: `${ano}-${mes}-${dia}`, desc: desc.trim(), valor: parseValor(valorStr) });
      pendenteDesc = [];
      continue;
    }
    const simples = linha.match(LINHA_TRANSACAO_SIMPLES);
    if (simples) {
      const [, dia, mes, ano, , valorStr] = simples;
      transacoes.push({ data: `${ano}-${mes}-${dia}`, desc: pendenteDesc.join(" ").trim() || "(sem descrição)", valor: parseValor(valorStr) });
      pendenteDesc = [];
      continue;
    }
    if (!RUIDO.test(linha)) pendenteDesc.push(linha);
  }

  return transacoes;
}
