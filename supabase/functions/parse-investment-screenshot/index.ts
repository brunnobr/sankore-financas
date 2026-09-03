// Edge Function: lê capturas de tela de apps de investimento (Banco Inter,
// Mercado Pago etc) e extrai {nome, valor} de cada posição via API da
// Claude (visão). Chamada pelo botão "Importar por print" em Investimentos
// — ver src/data/investments.js (extrairSaldosDePrint) e
// src/screens/Investimentos.jsx (ImportarPrintForm).
//
// Deploy (rodar na sua máquina, com Supabase CLI instalado e logado):
//   supabase functions deploy parse-investment-screenshot
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// A chave da Anthropic é sua (console.anthropic.com) — nunca cole ela no
// chat comigo, só no comando acima rodado localmente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SYSTEM_PROMPT = `Você lê capturas de tela de apps de investimento (Banco Inter, Mercado Pago etc) e extrai cada posição/ativo com seu saldo.

Regras:
- Responda APENAS com um array JSON, sem texto antes ou depois: [{"nome": "WRLD11", "valor": 2430.83}, ...]
- "nome" é o ticker ou nome do ativo/fundo exatamente como aparece na tela (ex: "WRLD11", "BTC", "COFRINHO MP", "CDB INTER").
- "valor" é o saldo, como número (ponto decimal, sem "R$", sem separador de milhar).
- Se o saldo estiver em dólar (US$) e não houver cotação visível na imagem pra converter, mantenha o valor em dólar e adicione "moeda": "USD" nesse item (sem esse campo, assume-se reais).
- Ignore botões, gráficos, textos de marketing ("Oportunidades", "Saber mais", "Comprar", "Vender" etc) — só posições reais com saldo.
- Não invente ativos que não aparecem na imagem. Se a imagem não tiver nenhuma posição legível, responda [].`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado." }, 401);

    const { imagens } = await req.json();
    if (!Array.isArray(imagens) || !imagens.length) return json({ error: "Nenhuma imagem enviada." }, 400);
    if (imagens.length > 10) return json({ error: "Máximo de 10 imagens por vez." }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY não configurada nos secrets do Supabase (rode: supabase secrets set ANTHROPIC_API_KEY=...)." }, 500);

    const content = [
      { type: "text", text: "Extraia os ativos e saldos dessas capturas de tela, seguindo as regras do sistema." },
      ...imagens.map((img: { data: string; mediaType: string }) => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      })),
    ];

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    });

    if (!resp.ok) return json({ error: `Erro na API da Claude (${resp.status}): ${await resp.text()}` }, 502);

    const data = await resp.json();
    const texto = (data.content || []).map((b: { text?: string }) => b.text || "").join("");
    const match = texto.match(/\[[\s\S]*\]/);
    if (!match) return json({ error: "Não consegui extrair dados estruturados da imagem.", bruto: texto }, 422);

    let itens;
    try {
      itens = JSON.parse(match[0]);
    } catch {
      return json({ error: "Resposta da IA não veio em JSON válido.", bruto: texto }, 422);
    }

    return json({ itens });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
