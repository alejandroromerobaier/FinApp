import { GoogleGenAI, Type } from '@google/genai';

export interface ParsedVoiceTransaction {
  type: 'expense' | 'income';
  amount: number;
  description: string;
  categoryName: string;
  paymentMethod: 'Efectivo' | 'Tarjeta';
  classification: 'fixed' | 'variable';
  destinationType: 'personal' | 'shared';
  projectName?: string | null;
}

const getApiKey = (): string => {
  return process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
};

/**
 * Parse text transcription into a structured financial transaction using Gemini.
 */
export const parseVoiceTextToTransaction = async (
  spokenText: string,
  categories: { id: string; name: string; type: string }[],
  projects: { id: string; name: string }[]
): Promise<ParsedVoiceTransaction> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API Key de Gemini no configurada');
  }

  const ai = new GoogleGenAI({ apiKey });

  const categoryNames = categories.map(c => c.name).join(', ');
  const projectNames = projects.map(p => p.name).join(', ');

  const prompt = `
Eres un asistente financiero inteligente de FinApp. Tu trabajo es interpretar el dictado por voz del usuario y extraer los datos de la transacción en formato JSON.

Texto dictado por el usuario: "${spokenText}"

Reglas de extracción:
1. "type": "expense" si es gasto/compra/pago, "income" si es ingreso/cobro/salario/regalo.
2. "amount": número positivo del monto mencionado (ej: 4500 para 4500 pesos).
3. "description": resumen corto del concepto o comercio (ej: "Supermercado Coto", "Nafta", "Cena").
4. "categoryName": intenta seleccionar la categoría más cercana de esta lista disponible del usuario: [${categoryNames}]. Si no encaja ninguna exacto, propone la más apropiada (ej: Comida, Transporte, Vivienda, Ocio, Salud, Educación, Otros, Salario, Inversiones, Regalo).
5. "paymentMethod": "Tarjeta" si menciona tarjeta/debito/credito/mp/transferencia, sino "Efectivo".
6. "classification": "fixed" si es recurrente/fijo (alquiler, luz, expensas), "variable" si es ocasional.
7. "destinationType": "shared" si menciona algún proyecto o grupo (ej: [${projectNames}]), sino "personal".
8. "projectName": si menciona un proyecto de la lista [${projectNames}], escribe su nombre exacto, de lo contrario null.
`;

  try {
    const response = await ai.models.generateContent({
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
            paymentMethod: { type: Type.STRING, enum: ['Efectivo', 'Tarjeta'] },
            classification: { type: Type.STRING, enum: ['fixed', 'variable'] },
            destinationType: { type: Type.STRING, enum: ['personal', 'shared'] },
            projectName: { type: Type.STRING, nullable: true }
          },
          required: ['type', 'amount', 'description', 'categoryName', 'paymentMethod', 'classification', 'destinationType']
        }
      }
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);

    return {
      type: parsed.type === 'income' ? 'income' : 'expense',
      amount: Math.abs(Number(parsed.amount) || 0),
      description: parsed.description || 'Gasto por Voz',
      categoryName: parsed.categoryName || 'Otros',
      paymentMethod: parsed.paymentMethod === 'Tarjeta' ? 'Tarjeta' : 'Efectivo',
      classification: parsed.classification === 'fixed' ? 'fixed' : 'variable',
      destinationType: parsed.destinationType === 'shared' ? 'shared' : 'personal',
      projectName: parsed.projectName || null
    };
  } catch (error) {
    console.error('Error parsing voice text with Gemini:', error);
    throw error;
  }
};
