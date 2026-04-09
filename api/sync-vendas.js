import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

// 🏢 EMPRESAS (IGUAL AO RECEBIMENTOS)
const EMPRESAS = [
  "VAREJO_URL_MERCATTO",
  "VAREJO_URL_VILLA",
  "VAREJO_URL_PADARIA",
  "VAREJO_URL_DELICIA"
];

// 🕒 DATA
function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const startGlobal = Date.now();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 SYNC GLOBAL VENDAS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {

    let totalGlobal = 0;
    let resultados = [];

    // 🔁 LOOP EMPRESAS
    for (const empresa of EMPRESAS) {

      const startEmpresa = Date.now();

      console.log(`\n🏢 PROCESSANDO: ${empresa}`);

      try {

        // 🔎 BUSCAR ÚLTIMA DATA
        const { data: ultima } = await supabase
          .from("vendas_realtime")
          .select("data_fechamento")
          .eq("empresa", empresa)
          .order("data_fechamento", { ascending: false })
          .limit(1)
          .maybeSingle();

        const ultimaData = ultima?.data_fechamento || hoje();

        console.log("📅 Última data:", ultimaData);

        // 🌐 CHAMAR SUA API (REUTILIZA RECEBIMENTOS)
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
          const erro = await apiResp.text();
          console.log(`❌ ERRO API (${empresa}):`, erro);

          resultados.push({
            empresa,
            ok: false,
            erro
          });

          continue; // 🔥 NÃO PARA O LOOP
        }

        const raw = await apiResp.json();
        const vendas = raw.items || [];

        console.log(`📦 ${empresa} → ${vendas.length} vendas`);

        if (!vendas.length) {
          resultados.push({
            empresa,
            ok: true,
            total: 0
          });
          continue;
        }

        // 🔄 TRANSFORMAR
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

        // 💾 UPSERT
        const { error } = await supabase
          .from("vendas_realtime")
          .upsert(inserts, {
            onConflict: "venda_id"
          });

        if (error) {
          console.log(`❌ ERRO SUPABASE (${empresa}):`, error.message);

          resultados.push({
            empresa,
            ok: false,
            erro: error.message
          });

          continue;
        }

        const tempo = ((Date.now() - startEmpresa) / 1000).toFixed(2);

        console.log(`✅ ${empresa} FINALIZADO (${inserts.length}) em ${tempo}s`);

        totalGlobal += inserts.length;

        resultados.push({
          empresa,
          ok: true,
          total: inserts.length,
          tempo
        });

      } catch (errEmpresa) {

        console.log(`💥 ERRO GERAL (${empresa}):`, errEmpresa.message);

        resultados.push({
          empresa,
          ok: false,
          erro: errEmpresa.message
        });

      }
    }

    const tempoTotal = ((Date.now() - startGlobal) / 1000).toFixed(2);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🏁 SYNC GLOBAL FINALIZADO");
    console.log(`📊 TOTAL: ${totalGlobal}`);
    console.log(`⏱ TEMPO: ${tempoTotal}s`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return res.json({
      ok: true,
      totalGlobal,
      tempoTotal,
      empresas: resultados
    });

  } catch (e) {

    console.log("💥 ERRO GLOBAL:", e);

    return res.status(500).json({
      ok: false,
      error: e.message
    });
  }
}
