import * as admin from 'firebase-admin';
import { GoogleGenAI, Type } from '@google/genai';

export interface ProcessResult {
  replyText: string;
}

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

/**
 * Handles incoming WhatsApp text or command for a given phone number.
 */
export const handleIncomingMessage = async (
  fromPhone: string,
  messageText: string
): Promise<string> => {
  const db = admin.firestore();
  const trimmed = messageText.trim();
  const lower = trimmed.toLowerCase();
  const cleanPhone = fromPhone.replace('+', '').trim();

  // 1. Check if user is trying to link account: "VINCULAR 123456"
  const linkMatch = trimmed.match(/^vincular\s+(\d{6})$/i);
  if (linkMatch) {
    const code = linkMatch[1];
    const codeRef = db.collection('whatsapp_linking_codes').doc(code);
    const codeDoc = await codeRef.get();

    if (!codeDoc.exists) {
      return `❌ *Código inválido o inexistente.*\nPor favor generá un nuevo PIN desde Ajustes en FinApp.`;
    }

    const codeData = codeDoc.data()!;
    const expiresAt = codeData.expiresAt?.toDate ? codeData.expiresAt.toDate() : new Date(codeData.expiresAt);
    if (new Date() > expiresAt) {
      await codeRef.delete();
      return `⚠️ *El código ha expirado.*\nLos códigos tienen una validez de 15 minutos. Generá uno nuevo en Ajustes de FinApp.`;
    }

    const userId = codeData.userId;
    // Link to user profile
    await db.collection('users').doc(userId).update({
      whatsappNumber: `+${cleanPhone}`,
      whatsappLinkedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Delete used code
    await codeRef.delete();

    // Get user name
    const userDoc = await db.collection('users').doc(userId).get();
    const userName = userDoc.data()?.name || 'Usuario';

    return `✅ *¡Listo ${userName}! Tu WhatsApp quedó vinculado con éxito a FinApp.*\n\n` +
      `Ya podés empezar a hablarme con total naturalidad o mandarme audios:\n` +
      `• _"Gasté 15.000 en el súper con débito"_\n` +
      `• _"Cargué 40 lucas de nafta en efectivo"_\n` +
      `• _"¿Cuánto gasté este mes?"_\n` +
      `• _"¿Cómo vengo con los presupuestos?"_`;
  }

  // 2. Find linked user by phone number
  const usersSnap = await db.collection('users')
    .where('whatsappNumber', 'in', [`+${cleanPhone}`, cleanPhone])
    .limit(1)
    .get();

  if (usersSnap.empty) {
    return `👋 *¡Hola! Todavía no tenés vinculado tu WhatsApp a tu cuenta de FinApp.*\n\n` +
      `Para sincronizarlo:\n` +
      `1. Entrá a *FinApp* > *Ajustes*.\n` +
      `2. En la sección *Asistente WhatsApp*, tocá *Generar PIN de Enlace*.\n` +
      `3. Respondé a este chat con el mensaje: *VINCULAR <CÓDIGO>*.`;
  }

  const userDoc = usersSnap.docs[0];
  const userId = userDoc.id;
  const userData = userDoc.data();
  const userName = userData.name || 'Usuario';
  const currency = userData.currency || 'ARS';

  // 3. HELP
  if (/^(hola|buenas|buen dia|menu|ayuda|help|\?)$/i.test(lower)) {
    return `👋 *¡Hola ${userName}!* Soy tu asistente de *FinApp*.\n\n` +
      `¿En qué te puedo ayudar hoy?\n\n` +
      `💸 *Registrar:* _"Gasté 8500 en farmacia con tarjeta"_\n` +
      `📊 *Resumen:* _"¿Cuánto gasté este mes?"_\n` +
      `🎯 *Límites:* _"¿Cómo vengo con los presupuestos?"_\n` +
      `↩️ *Corregir:* _"Deshacer último gasto"_`;
  }

  // 4. UNDO / DELETE LAST
  if (/\b(deshacer|borrar ultimo|borrar último|eliminar ultimo|eliminar último)\b/i.test(lower)) {
    const txSnap = await db.collection('transactions')
      .where('authorId', '==', userId)
      .orderBy('date', 'desc')
      .limit(1)
      .get();

    if (txSnap.empty) {
      return `⚠️ No se encontraron movimientos recientes para anular.`;
    }

    const lastTx = txSnap.docs[0];
    const data = lastTx.data();
    await lastTx.ref.delete();

    return `🗑️ *Movimiento anulado:*\n` +
      `• *Detalle:* ${data.description || 'Gasto'}\n` +
      `• *Monto:* $${data.amount} ${currency}\n` +
      `• *Categoría:* ${data.categoryName || 'General'}\n\n` +
      `Tus saldos se actualizaron en FinApp.`;
  }

  // 5. SUMMARY / BALANCE QUERY
  if (/\b(cuanto gaste|cuánto gasté|resumen|balance|total gastado)\b/i.test(lower)) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const txSnap = await db.collection('transactions')
      .where('authorId', '==', userId)
      .where('date', '>=', startOfMonth)
      .get();

    let totalExpense = 0;
    let totalIncome = 0;
    const catMap: Record<string, number> = {};

    txSnap.docs.forEach(doc => {
      const d = doc.data();
      const amt = Number(d.amount) || 0;
      if (d.type === 'expense' || !d.type) {
        totalExpense += amt;
        const c = d.categoryName || 'Otros';
        catMap[c] = (catMap[c] || 0) + amt;
      } else if (d.type === 'income') {
        totalIncome += amt;
      }
    });

    const net = totalIncome - totalExpense;
    const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

    let rep = `📊 *Resumen Mensual (${currentMonth})*\n━━━━━━━━━━━━━━━━━━\n` +
      `🔴 *Gastos Totales:* $${totalExpense.toLocaleString('es-AR')} ${currency}\n` +
      `🟢 *Ingresos:* $${totalIncome.toLocaleString('es-AR')} ${currency}\n` +
      `💰 *Balance:* ${net >= 0 ? '+' : ''}$${net.toLocaleString('es-AR')} ${currency}\n\n`;

    if (topCats.length > 0) {
      rep += `🏆 *Mayores Gastos:*\n`;
      topCats.forEach(([c, val], i) => {
        rep += `${i + 1}. *${c}:* $${val.toLocaleString('es-AR')}\n`;
      });
    }

    return rep;
  }

  // 6. RECORD EXPENSE / INCOME WITH GEMINI
  try {
    // Fetch categories and projects to guide the AI
    const catsSnap = await db.collection('categories').get();
    const userCats = catsSnap.docs.map(d => d.data().name).filter(Boolean);

    const projsSnap = await db.collection('projects')
      .where('memberIds', 'array-contains', userId)
      .get();
    const userProjects = projsSnap.docs.map(d => d.data().name).filter(Boolean);

    const ai = getGeminiClient();
    if (!ai) {
      return `⚠️ El servicio de Inteligencia Artificial no está configurado (falta GEMINI_API_KEY).`;
    }

    const prompt = `
Interpreta este mensaje de un usuario para registrar un gasto o ingreso financiero:
"${trimmed}"

Categorías disponibles: [${userCats.join(', ')}]
Proyectos compartidos: [${userProjects.join(', ')}]

Extrae:
- type: "expense" | "income"
- amount: número positivo
- description: detalle del gasto
- categoryName: la más adecuada de las disponibles
- paymentMethod: "Efectivo" | "Tarjeta" | "Transferencia"
- projectName: si menciona un proyecto de la lista, o null
`;

    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['expense', 'income'] },
            amount: { type: Type.NUMBER },
            description: { type: Type.STRING },
            categoryName: { type: Type.STRING },
            paymentMethod: { type: Type.STRING },
            projectName: { type: Type.STRING, nullable: true }
          },
          required: ['type', 'amount', 'description', 'categoryName', 'paymentMethod']
        }
      }
    });

    const parsed = JSON.parse(res.text || '{}');
    if (!parsed.amount || parsed.amount <= 0) {
      return `🤔 No entendí el monto del gasto o consulta.\nEjemplo: _"Gasté 15.000 en el súper con débito"_`;
    }

    let matchedProjId: string | null = null;
    if (parsed.projectName) {
      const pDoc = projsSnap.docs.find(d => d.data().name?.toLowerCase() === parsed.projectName?.toLowerCase());
      if (pDoc) matchedProjId = pDoc.id;
    }

    // Save transaction
    await db.collection('transactions').add({
      type: parsed.type,
      amount: parsed.amount,
      description: parsed.description,
      categoryName: parsed.categoryName,
      paymentMethod: parsed.paymentMethod,
      projectId: matchedProjId,
      authorId: userId,
      authorName: userName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      date: admin.firestore.Timestamp.fromDate(new Date())
    });

    const isExp = parsed.type === 'expense';
    return `${isExp ? '💸 *Gasto registrado*' : '💰 *Ingreso registrado*'} con éxito ✅\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💵 *Monto:* $${parsed.amount.toLocaleString('es-AR')} ${currency}\n` +
      `🏷️ *Categoría:* ${parsed.categoryName}\n` +
      `📝 *Detalle:* ${parsed.description}\n` +
      `💳 *Método:* ${parsed.paymentMethod}\n` +
      `${matchedProjId ? `📁 *Proyecto:* ${parsed.projectName}\n` : '👤 *Bóveda:* Personal\n'}` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💡 _Escribí "Deshacer" para anularlo._`;
  } catch (err) {
    console.error('Error in handleIncomingMessage:', err);
    return `⚠️ Ocurrió un error al procesar tu solicitud. Probá nuevamente o escribí *Ayuda*.`;
  }
};
