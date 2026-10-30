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

  // 6. RECORD EXPENSE / INCOME WITH GEMINI OR SMART FALLBACK
  try {
    // Fetch categories and projects to guide the AI
    const catsSnap = await db.collection('categories').get();
    const userCats = catsSnap.docs.map(d => ({ id: d.id, name: d.data().name, type: d.data().type || 'expense' })).filter(c => Boolean(c.name));

    const projsSnap = await db.collection('projects')
      .where('memberIds', 'array-contains', userId)
      .get();
    const userProjects = projsSnap.docs.map(d => ({ id: d.id, name: d.data().name })).filter(p => Boolean(p.name));

    let parsed: any = null;
    const ai = getGeminiClient();

    if (ai) {
      try {
        const prompt = `
Interpreta este mensaje de un usuario para registrar un gasto o ingreso financiero:
"${trimmed}"

Categorías disponibles: [${userCats.map(c => c.name).join(', ')}]
Proyectos compartidos: [${userProjects.map(p => p.name).join(', ')}]

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
        parsed = JSON.parse(res.text || '{}');
      } catch (geminiErr) {
        console.warn('Gemini call failed, falling back to local NLP parser:', geminiErr);
      }
    }

    // Fallback if Gemini not available or failed
    if (!parsed || !parsed.amount) {
      parsed = fallbackParseText(trimmed, userCats, userProjects);
    }
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

/**
 * Robust local NLP parser for Argentine Spanish amounts, categories and payment methods.
 */
function fallbackParseText(
  text: string,
  categories: { id: string; name: string; type: string }[],
  projects: { id: string; name: string }[]
): any {
  const lower = text.toLowerCase();

  // 1. Detect Type
  const isIncome = /\b(ingreso|cobré|cobre|gané|gane|recibí|recibi|salario|sueldo|entrada|regalo|cobro)\b/i.test(lower);
  const type = isIncome ? 'income' : 'expense';

  // 2. Parse Amount (supporting millions: "2 millones", "1.5 millones", "500 mil", "40 lucas", "$15.000")
  let amount = 0;

  // Millions
  const millMatch = lower.match(/(?:\$|\b)(\d+(?:[.,]\d+)?)\s*(?:de\s*)?(?:millón|millon|millones)\b/i);
  if (millMatch) {
    amount = Math.round(parseFloat(millMatch[1].replace(',', '.')) * 1_000_000);
  }

  // Lucas / Miles
  if (!amount) {
    const lucasMatch = lower.match(/(?:\$|\b)(\d+(?:[.,]\d+)?)\s*(?:lucas|mil)\b/i);
    if (lucasMatch) {
      amount = Math.round(parseFloat(lucasMatch[1].replace(',', '.')) * 1_000);
    }
  }

  // Standard numbers
  if (!amount) {
    const numMatches = lower.match(/(?:\$|ar\$)?\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)/g);
    if (numMatches) {
      for (const raw of numMatches) {
        const clean = raw.replace(/[^\d.,]/g, '').trim();
        let val = 0;
        if (clean.includes('.') && !clean.includes(',')) {
          const parts = clean.split('.');
          if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
            val = parseFloat(clean.replace(/\./g, ''));
          } else {
            val = parseFloat(clean);
          }
        } else if (clean.includes('.') && clean.includes(',')) {
          val = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
        } else if (clean.includes(',')) {
          val = parseFloat(clean.replace(',', '.'));
        } else {
          val = parseFloat(clean);
        }
        if (val > 0) {
          amount = val;
          break;
        }
      }
    }
  }

  // 3. Payment Method
  const isCard = /\b(tarjeta|debito|débito|credito|crédito|mp|mercado pago|transferencia)\b/i.test(lower);
  const paymentMethod = isCard ? 'Tarjeta' : 'Efectivo';

  // 4. Project
  let projectName: string | null = null;
  for (const p of projects) {
    if (lower.includes(p.name.toLowerCase())) {
      projectName = p.name;
      break;
    }
  }

  // 5. Category
  let categoryName = type === 'income' ? 'Salario' : 'Otros';
  for (const c of categories) {
    if (lower.includes(c.name.toLowerCase())) {
      categoryName = c.name;
      break;
    }
  }

  // Common keywords map
  if (categoryName === 'Otros') {
    if (/\b(super|supermercado|chino|almacen|comida|almuerzo|cena|desayuno|restaurante|cafe|café|panaderia|helado|pedidosya|rappi)\b/i.test(lower)) {
      categoryName = 'Comida';
    } else if (/\b(nafta|combustible|ypf|shell|axion|taxi|uber|cabify|colectivo|sube|tren|peaje|estacionamiento)\b/i.test(lower)) {
      categoryName = 'Transporte';
    } else if (/\b(farmacia|remedio|medico|médico|salud|dentista|dentista|clinica)\b/i.test(lower)) {
      categoryName = 'Salud';
    } else if (/\b(alquiler|expensas|luz|gas|agua|internet|wifi|cable)\b/i.test(lower)) {
      categoryName = 'Vivienda';
    } else if (/\b(cine|salida|bar|cerveza|juego|boliche|fiesta|streaming|spotify|netflix)\b/i.test(lower)) {
      categoryName = 'Ocio';
    }
  }

  // 6. Clean description
  let description = text
    .replace(/(?:gasté|gaste|pagué|pague|compré|compre|cargué|cargue|anotá|anota|registrá|registra)/gi, '')
    .replace(/(?:\$|ar\$)?\s*\d+(?:[.,]\d+)?(?:\s*(?:mil|lucas|millón|millon|millones))?/gi, '')
    .replace(/\b(con|en|de|el|la|los|las|por|pesos|efectivo|tarjeta|debito|débito|credito|crédito)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!description || description.length < 2) {
    description = `${type === 'expense' ? 'Gasto' : 'Ingreso'} de ${categoryName}`;
  } else {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  return {
    type,
    amount,
    description,
    categoryName,
    paymentMethod,
    projectName
  };
}

