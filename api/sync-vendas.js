import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

// 🕒 DATA AJUSTADA (Bahia)
function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const start = Date.now();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 SYNC VENDAS INICIADO");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {

    // 🔥 SUPORTE GET + POST
    const { empresa } = req.body || req.query || {};

    if (!empresa) {
      console.log("❌ Empresa não informada");
      return res.status(400).json({
        ok: false,
        error: "Empresa é obrigatória"
      });
    }

    console.log("🏢 Empresa:", empresa);

    // 🔎 BUSCAR ÚLTIMA DATA
    const { data: ultima, error: erroUltima } = await supabase
      .from("vendas_realtime")
      .select("data_fechamento")
      .eq("empresa", empresa)
      .order("data_fechamento", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (erroUltima) {
      console.log("⚠️ Erro ao buscar última venda:", erroUltima.message);
    }

    const ultimaData = ultima?.data_fechamento || hoje();

    console.log("📅 Última data encontrada:", ultimaData);

    // 🌐 CHAMAR API EXTERNA
    console.log("🌐 Buscando vendas na API...");

    const apiResp = await fetch(process.env.API_URL_RECEBIMENTOS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        empresa,
        dataInicio: ultimaData,
        dataFim: hoje()
      })
    });

    if (!apiResp.ok) {
      const erroTexto = await apiResp.text();
      console.log("❌ Erro API externa:", erroTexto);

      return res.status(500).json({
        ok: false,
        error: "Erro ao consultar API externa",
        detalhe: erroTexto
      });
    }

    const raw = await apiResp.json();
    const vendas = raw.items || [];

    console.log(`📦 Vendas recebidas: ${vendas.length}`);

    if (!vendas.length) {
      return res.json({
        ok: true,
        total: 0,
        message: "Nenhuma venda nova"
      });
    }

    // 🔄 TRANSFORMAR DADOS
    const inserts = vendas.map(v => ({
      empresa,
      loja_id: v.lojaId,
      venda_id: v.id,
      data: v.dataVenda,
      data_fechamento: v.dataHoraFechamentoCupom,
      valor: v.valor,
      desconto: v.desconto,
      acrescimo: v.acrescimo,
      finalizadora_ids: v.finalizacoes?.map(f => f.finalizadoraId) || [],
      finalizadora_principal: v.finalizacoes?.[0]?.finalizadoraId || null,
      cancelada: v.cancelada,
      cliente_id: v.clienteId,
      funcionario_id: v.funcionarioId,
      json_completo: v
    }));

    console.log("💾 Salvando no Supabase...");

    const { error: erroInsert } = await supabase
      .from("vendas_realtime")
      .upsert(inserts, {
        onConflict: "venda_id"
      });

    if (erroInsert) {
      console.log("❌ Erro ao salvar:", erroInsert.message);

      return res.status(500).json({
        ok: false,
        error: erroInsert.message
      });
    }

    const tempo = ((Date.now() - start) / 1000).toFixed(2);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ SYNC FINALIZADO");
    console.log(`📊 Total: ${inserts.length}`);
    console.log(`⏱ Tempo: ${tempo}s`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return res.json({
      ok: true,
      empresa,
      total: inserts.length,
      tempo
    });

  } catch (e) {
    console.log("💥 ERRO GERAL:", e);

    return res.status(500).json({
      ok: false,
      error: e.message
    });
  }
}
