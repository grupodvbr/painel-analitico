// /api/firestore.js
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    const { empresa, data, valor_total, resumo } = req.body;

    if (!empresa || !data) {
      return res.status(400).json({ error: "Empresa e data são obrigatórias." });
    }

    const ref = db.collection("entradas_financeiras").doc(`${data}_${empresa}`);
    await ref.set({
      empresa,
      data,
      valor_total,
      resumo,
      atualizado_em: new Date().toISOString(),
    }, { merge: true });

    console.log(`✅ Gravado: ${empresa} (${data})`);
    return res.status(200).json({ success: true, empresa });
  } catch (e) {
    console.error("🔥 Erro Firestore:", e);
    return res.status(500).json({ error: e.message });
  }
}
