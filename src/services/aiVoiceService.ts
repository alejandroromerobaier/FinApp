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
 * Robust parser for amounts supporting millions ("2 millones", "1.5 millones", "$2.500.000", "500 mil")
 */
export const parseAmountWithMillions = (text: string): number => {
  const lower = text.toLowerCase().trim();

  const spanishNumberWords: Record<string, number> = {
    'medio': 0.5,
    'un': 1,
    'uno': 1,
    'una': 1,
    'dos': 2,
    'tres': 3,
    'cuatro': 4,
    'cinco': 5,
    'seis': 6,
    'siete': 7,
    'ocho': 8,
    'nueve': 9,
    'diez': 10,
    'veinte': 20,
    'cincuenta': 50,
    'cien': 100
  };

  // 1. Spoken millions (e.g. "2 millones", "1.5 millones", "1,5 millones", "un millon", "medio millon")
  const millionMatch = lower.match(/(?:\$|\b)(\d+(?:[.,]\d+)?|[a-z]+)\s*(?:de\s*)?(?:millón|millon|millones)\b/i);
  if (millionMatch) {
    const valStr = millionMatch[1].trim();
    let numVal = 0;
    if (spanishNumberWords[valStr] !== undefined) {
      numVal = spanishNumberWords[valStr];
    } else {
      const cleanVal = valStr.replace(',', '.');
      numVal = parseFloat(cleanVal) || 0;
    }
    if (numVal > 0) {
      return Math.round(numVal * 1_000_000);
    }
  }

  // 2. Spoken thousands (e.g. "500 mil", "cincuenta mil")
  const thousandMatch = lower.match(/(?:\$|\b)(\d+(?:[.,]\d+)?|[a-z]+)\s*(?:de\s*)?(?:mil)\b/i);
  if (thousandMatch) {
    const valStr = thousandMatch[1].trim();
    let numVal = 0;
    if (spanishNumberWords[valStr] !== undefined) {
      numVal = spanishNumberWords[valStr];
    } else {
      const cleanVal = valStr.replace(',', '.');
      numVal = parseFloat(cleanVal) || 0;
    }
    if (numVal > 0) {
      return Math.round(numVal * 1_000);
    }
  }

  // 3. Numeric representations (e.g. 2.500.000 or 10.000.000 or $22.000 or 2500000)
  const numericMatch = lower.match(/(?:\$|\b)(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+)/);
  if (numericMatch) {
    let raw = numericMatch[1];

    if ((raw.match(/\./g) || []).length > 1) {
      raw = raw.replace(/\./g, '');
    } else if ((raw.match(/,/g) || []).length > 1) {
      raw = raw.replace(/,/g, '');
    } else if (raw.includes('.') && raw.includes(',')) {
      if (raw.indexOf('.') < raw.indexOf(',')) {
        raw = raw.replace(/\./g, '').replace(',', '.');
      } else {
        raw = raw.replace(/,/g, '');
      }
    } else if (raw.includes('.')) {
      const parts = raw.split('.');
      if (parts[1] && parts[1].length === 3) {
        raw = raw.replace('.', '');
      }
    } else if (raw.includes(',')) {
      const parts = raw.split(',');
      if (parts[1] && parts[1].length === 3) {
        raw = raw.replace(',', '');
      } else {
        raw = raw.replace(',', '.');
      }
    }

    return Math.abs(parseFloat(raw)) || 0;
  }

  return 0;
};

/**
 * Builds a summary string of the user's historical transaction descriptions and categories.
 */
const buildHistorySummary = (transactions?: any[]): string => {
  if (!transactions || transactions.length === 0) return 'Sin historial previo.';
  
  const freqMap: Record<string, Record<string, number>> = {};
  for (const tx of transactions) {
    if (!tx.description || !tx.categoryName) continue;
    const desc = tx.description.toLowerCase().trim();
    if (desc.length < 2) continue;
    
    if (!freqMap[desc]) freqMap[desc] = {};
    freqMap[desc][tx.categoryName] = (freqMap[desc][tx.categoryName] || 0) + 1;
  }

  const rules: string[] = [];
  for (const [desc, catMap] of Object.entries(freqMap)) {
    let topCat = '';
    let maxCount = 0;
    for (const [catName, count] of Object.entries(catMap)) {
      if (count > maxCount) {
        maxCount = count;
        topCat = catName;
      }
    }
    if (topCat) {
      rules.push(`"${desc}" => "${topCat}"`);
    }
  }

  return rules.slice(0, 20).join(', ');
};

/**
 * Fallback smart parser using RegEx, Natural Language rules, and user history.
 */
export const parseVoiceTextLocally = (
  spokenText: string,
  categories: { id: string; name: string; type: string }[],
  projects: { id: string; name: string }[],
  userTransactions?: any[]
): ParsedVoiceTransaction => {
  const text = spokenText.toLowerCase().trim();

  // 1. Detect Type
  const isIncome = /\b(ingreso|cobré|cobre|gané|gane|recibí|recibi|salario|sueldo|entrada|regalo|cobro|facturé|facture)\b/i.test(text);
  const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

  // 2. Detect Amount (with millions support)
  const amount = parseAmountWithMillions(text);

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

  // 6. Detect Category (Prioritizing User History -> Direct Category Name -> Keywords Map)
  let matchedCategoryName = type === 'income' ? 'Salario' : 'Otros';
  const filteredCats = categories.filter(c => c.type === type);
  let foundCategory = false;

  // A. Check user's historical transactions for matching description phrases
  if (userTransactions && userTransactions.length > 0) {
    const historicalMap = new Map<string, string>();
    for (const tx of userTransactions) {
      if (tx.description && tx.categoryName && (tx.type === type || !tx.type)) {
        const descLower = tx.description.toLowerCase().trim();
        if (descLower.length >= 3 && !historicalMap.has(descLower)) {
          historicalMap.set(descLower, tx.categoryName);
        }
      }
    }

    const sortedDescs = Array.from(historicalMap.keys()).sort((a, b) => b.length - a.length);
    for (const histDesc of sortedDescs) {
      if (text.includes(histDesc)) {
        const histCatName = historicalMap.get(histDesc)!;
        const targetCat = categories.find(c => c.name.toLowerCase() === histCatName.toLowerCase());
        if (targetCat) {
          matchedCategoryName = targetCat.name;
          foundCategory = true;
          break;
        }
      }
    }
  }

  // B. Check direct category names
  if (!foundCategory) {
    for (const cat of filteredCats) {
      if (text.includes(cat.name.toLowerCase())) {
        matchedCategoryName = cat.name;
        foundCategory = true;
        break;
      }
    }
  }

  // C. Fallback keywords map
  if (!foundCategory) {
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

  // If matched category is still generic and user has categories, default to first category of matching type
  if ((matchedCategoryName === 'Otros' || matchedCategoryName === 'Salario') && filteredCats.length > 0) {
    const matchingNamedCat = filteredCats.find(c => c.name.toLowerCase() === matchedCategoryName.toLowerCase());
    if (matchingNamedCat) {
      matchedCategoryName = matchingNamedCat.name;
    } else if (filteredCats.length > 0) {
      matchedCategoryName = filteredCats[0].name;
    }
  }

  // 7. Extract Clean Description
  let cleanDesc = spokenText
    .replace(/(?:registrar|gasto|ingreso|de|\$|\b\d+(?:[.,]\d+)?\b|con tarjeta|en efectivo|pesos|millón|millon|millones|mil)/gi, '')
    .trim();
  
  if (!cleanDesc || cleanDesc.length < 2) {
    cleanDesc = `${type === 'expense' ? 'Gasto' : 'Ingreso'} de ${matchedCategoryName}`;
  } else {
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
  projects: { id: string; name: string }[],
  userTransactions?: any[]
): Promise<ParsedVoiceTransaction> => {
  const apiKey = getApiKey();

  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const categoryNames = categories.map(c => c.name).join(', ');
      const projectNames = projects.map(p => p.name).join(', ');
      const historyRules = buildHistorySummary(userTransactions);

      const prompt = `
Eres un asistente financiero inteligente de FinApp. Tu trabajo es interpretar el dictado por voz del usuario y extraer los datos de la transacción en formato JSON.

Texto dictado por el usuario: "${spokenText}"

Historial previo de categorías asignadas por el usuario (concepto => categoría):
[${historyRules}]

Reglas de extracción:
1. "type": "expense" si es gasto/compra/pago, "income" si es ingreso/cobro/salario/regalo/ganancia.
2. "amount": número positivo del monto mencionado. IMPORTANTE: Maneja millones y miles adecuadamente. 
   - Ej: "2 millones" -> 2000000
   - Ej: "1.5 millones" o "1,5 millones" -> 1500000
   - Ej: "$2.500.000" -> 2500000
   - Ej: "500 mil" -> 500000
   NUNCA devuelvas 2 o 1.5 cuando se especifiquen millones.
3. "description": resumen corto del concepto o comercio (ej: "Comida", "Supermercado Coto", "Honorarios").
4. "categoryName": selecciona la categoría adecuada de la lista disponible del usuario: [${categoryNames}]. ATENCIÓN: Ten muy en cuenta el historial previo del usuario. Si el usuario suele clasificar "comida" como "Comida", asígnalo a "Comida" y NO a "Vivienda".
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
  return parseVoiceTextLocally(spokenText, categories, projects, userTransactions);
};
