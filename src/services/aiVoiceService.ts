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
 * Fallback smart parser using RegEx and Natural Language rules when Gemini is offline or unconfigured.
 */
export const parseVoiceTextLocally = (
  spokenText: string,
  categories: { id: string; name: string; type: string }[],
  projects: { id: string; name: string }[]
): ParsedVoiceTransaction => {
  const text = spokenText.toLowerCase().trim();

  // 1. Detect Type
  const isIncome = /\b(ingreso|cobré|cobre|gané|gane|recibí|recibi|salario|sueldo|entrada|regalo)\b/i.test(text);
  const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

  // 2. Detect Amount (e.g. $22,000, $22.000, 22000, 4500, 4.500,50)
  let amount = 0;
  // Match currency pattern like $22,000 or numbers
  const amountMatch = text.match(/(?:\$|\b)(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+)/);
  if (amountMatch) {
    let rawNum = amountMatch[1];
    // Remove thousand separators and normalize decimal dots
    if (rawNum.includes(',') && rawNum.includes('.')) {
      rawNum = rawNum.replace(/\./g, '').replace(',', '.');
    } else if (rawNum.includes(',')) {
      // Check if comma is decimal (2 digits after comma) or thousand separator
      const parts = rawNum.split(',');
      if (parts[1] && parts[1].length === 2) {
        rawNum = parts[0] + '.' + parts[1];
      } else {
        rawNum = rawNum.replace(/,/g, '');
      }
    } else if (rawNum.includes('.')) {
      const parts = rawNum.split('.');
      if (parts[1] && parts[1].length === 3 && parts[0].length <= 3) {
        rawNum = rawNum.replace(/\./g, '');
      }
    }
    amount = Math.abs(parseFloat(rawNum)) || 0;
  }

  // 3. Detect Payment Method
  const isCard = /\b(tarjeta|debito|débito|credito|crédito|mp|mercado pago|transferencia)\b/i.test(text);
  const paymentMethod: 'Efectivo' | 'Tarjeta' = isCard ? 'Tarjeta' : 'Efectivo';

  // 4. Detect Classification
  const isFixed = /\b(fijo|fija|alquiler|expensas|luz|gas|agua|internet|patente|suscripcion)\b/i.test(text);
  const classification: 'fixed' | 'variable' = isFixed ? 'fixed' : 'variable';

  // 5. Detect Project Destination
  let destinationType: 'personal' | 'shared' = 'personal';
  let matchedProjectName: string | null = null;

  for (const proj of projects) {
    if (text.includes(proj.name.toLowerCase())) {
      destinationType = 'shared';
      matchedProjectName = proj.name;
      break;
    }
  }
  if (!matchedProjectName && /\b(compartido|bóveda|boveda|proyecto)\b/i.test(text)) {
    destinationType = 'shared';
    if (projects.length > 0) {
      matchedProjectName = projects[0].name;
    }
  }

  // 6. Detect Category
  let matchedCategoryName = type === 'income' ? 'Salario' : 'Otros';
  const categoryKeywordsMap: Record<string, string[]> = {
    'Comida': ['comida', 'supermercado', 'coto', 'dia', 'carrefour', 'jumbo', 'vea', 'super', 'almacen', 'almuerzo', 'cena', 'desayuno', 'restaurante', 'pedidosya', 'rappi', 'panaderia'],
    'Transporte': ['transporte', 'sube', 'colectivo', 'taxi', 'uber', 'cabify', 'nafta', 'combustible', 'peaje', 'estacionamiento', 'auto'],
    'Vivienda': ['vivienda', 'alquiler', 'expensas', 'luz', 'gas', 'agua', 'internet', 'cable', 'mantenimiento'],
    'Ocio': ['ocio', 'cine', 'salida', 'bar', 'cerveza', 'juego', 'juegos', 'fiesta', 'streaming', 'netflix', 'spotify'],
    'Salud': ['salud', 'farmacia', 'remedio', 'medico', 'médico', 'consulta', 'obra social', 'prepaga', 'dentista'],
    'Educación': ['educación', 'educacion', 'colegio', 'escuela', 'universidad', 'curso', 'libro', 'facultad'],
    'Salario': ['salario', 'sueldo', 'cobro', 'honorarios', 'remuneracion'],
    'Inversiones': ['inversión', 'inversion', 'rendimiento', 'interés', 'interes', 'plazo fijo', 'cripto'],
    'Regalo': ['regalo', 'cumpleaños', 'cumple', 'donación']
  };

  // First check exact category names in text
  const filteredCats = categories.filter(c => c.type === type);
  for (const cat of filteredCats) {
    if (text.includes(cat.name.toLowerCase())) {
      matchedCategoryName = cat.name;
      break;
    }
  }

  // If no direct name match, use keywords
  if (matchedCategoryName === 'Otros' || matchedCategoryName === 'Salario') {
    for (const [catName, keywords] of Object.entries(categoryKeywordsMap)) {
      if (keywords.some(kw => text.includes(kw))) {
        const catObj = filteredCats.find(c => c.name.toLowerCase() === catName.toLowerCase());
        if (catObj) {
          matchedCategoryName = catObj.name;
          break;
        }
      }
    }
  }

  // 7. Extract Clean Description
  let cleanDesc = spokenText
    .replace(/(?:registrar|gasto|ingreso|de|\$|\b\d+(?:[.,]\d+)?\b|con tarjeta|en efectivo|pesos)/gi, '')
    .trim();
  
  if (!cleanDesc || cleanDesc.length < 2) {
    cleanDesc = `${type === 'expense' ? 'Gasto' : 'Ingreso'} de ${matchedCategoryName}`;
  } else {
    // Capitalize first letter
    cleanDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
  }

  return {
    type,
    amount,
    description: cleanDesc,
    categoryName: matchedCategoryName,
    paymentMethod,
    classification,
    destinationType,
    projectName: matchedProjectName
  };
};

/**
 * Main parser entry point: Tries Gemini AI first, falls back to smart local parser.
 */
export const parseVoiceTextToTransaction = async (
  spokenText: string,
  categories: { id: string; name: string; type: string }[],
  projects: { id: string; name: string }[]
): Promise<ParsedVoiceTransaction> => {
  const apiKey = getApiKey();

  // If API key is present, attempt Gemini API AI structured extraction
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const categoryNames = categories.map(c => c.name).join(', ');
      const projectNames = projects.map(p => p.name).join(', ');

      const prompt = `
Eres un asistente financiero inteligente de FinApp. Tu trabajo es interpretar el dictado por voz del usuario y extraer los datos de la transacción en formato JSON.

Texto dictado por el usuario: "${spokenText}"

Reglas de extracción:
1. "type": "expense" si es gasto/compra/pago, "income" si es ingreso/cobro/salario/regalo.
2. "amount": número positivo del monto mencionado (ej: 22000 para 22000 pesos o $22,000).
3. "description": resumen corto del concepto o comercio (ej: "Comida", "Supermercado Coto", "Nafta").
4. "categoryName": intenta seleccionar la categoría más cercana de esta lista disponible del usuario: [${categoryNames}]. Si no encaja ninguna exacto, propone la más apropiada.
5. "paymentMethod": "Tarjeta" si menciona tarjeta/debito/credito/mp/transferencia, sino "Efectivo".
6. "classification": "fixed" si es recurrente/fijo, "variable" si es ocasional.
7. "destinationType": "shared" si menciona algún proyecto o grupo (ej: [${projectNames}]), sino "personal".
8. "projectName": si menciona un proyecto de la lista [${projectNames}], escribe su nombre exacto, de lo contrario null.
`;

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
    } catch (geminiError) {
      console.warn('Gemini API parse failed, falling back to smart local parser:', geminiError);
    }
  }

  // Local Smart Natural Language Fallback
  return parseVoiceTextLocally(spokenText, categories, projects);
};
