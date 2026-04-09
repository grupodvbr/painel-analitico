export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { empresa } = req.body;

    // 🔹 URLs específicas por empresa
    const urls = {
      VAREJO_URL_MERCATTO: "https://mercatto.varejofacil.com/api/auth",         // Mercatto Delícia
      VAREJO_URL_VILLA: "https://deliciagourmet.varejofacil.com/api/auth",      // Villa Gourmet
      VAREJO_URL_PADARIA: "https://mercattodelicia.varejofacil.com/api/auth",   // Padaria Delícia
      VAREJO_URL_DELICIA: "https://villachopp.varejofacil.com/api/auth"         // Varejo Delícia
    };

    // 🔹 Escolhe a base correta
    const BASE_URL = urls[empresa];
    if (!BASE_URL) {
      return res.status(400).json({ error: `Empresa '${empresa}' não reconhecida.` });
    }

    // 🔹 Credenciais vindas do Vercel (seguras)
    const username = process.env.MERCATTO_USER;
    const password = process.env.MERCATTO_PASS;

    if (!username || !password) {
      return res.status(500).json({ error: "Credenciais não configuradas nas variáveis do Vercel." });
    }

    // 🔹 Corpo XML exigido pela API do Varejo Fácil
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<Usuario>
  <username>${username}</username>
  <password>${password}</password>
</Usuario>`;

    console.log(`🔐 Gerando token para ${empresa} → ${BASE_URL}`);

    // 🔹 Requisição de autenticação
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        "Accept": "application/json"
      },
      body: xmlBody
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Falha ao autenticar (${empresa}):`, text);
      return res.status(response.status).send(text);
    }

    // 🔹 Retorna o token da empresa correspondente
    const data = await response.json();
    return res.status(200).json({
      ...data,
      empresa,
      baseUrl: BASE_URL
    });

  } catch (error) {
    console.error("❌ Erro geral no login:", error);
    return res.status(500).json({
      error: "Erro ao autenticar",
      details: error.message
    });
  }
}
