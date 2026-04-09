import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  try {
    const { empresa } = req.body;

    const { data: ultima } = await supabase
      .from("vendas_realtime")
      .select("data_fechamento")
      .eq("empresa", empresa)
      .order("data_fechamento", { ascending: false })
      .limit(1)
      .single();

    const ultimaData = ultima?.data_fechamento;

    const apiResp = await fetch(process.env.API_URL_RECEBIMENTOS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresa,
        dataInicio: ultimaData || new Date().toISOString().slice(0,10),
        dataFim: new Date().toISOString().slice(0,10)
      })
    });

    const raw = await apiResp.json();
    const vendas = raw.items || [];

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

    if (inserts.length) {
      await supabase
        .from("vendas_realtime")
        .upsert(inserts, { onConflict: "venda_id" });
    }

    res.json({ ok: true, total: inserts.length });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
