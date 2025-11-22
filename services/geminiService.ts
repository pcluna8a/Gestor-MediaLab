
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { LoanRecord, Equipment, MaintenanceSuggestion } from '../types';
import { firebaseConfig } from '../firebaseConfig';

// Helper to safely get API Key
const getApiKey = () => {
  try {
    // 1. Try process.env (Build time / Environment) - Safe check
    // @ts-ignore
    if (typeof process !== 'undefined' && process?.env?.API_KEY) {
      // @ts-ignore
      return process.env.API_KEY;
    }
    
    // 2. Fallback to Firebase Config Key (Runtime) - Assuming Gemini API is enabled on the same project
    if (firebaseConfig && firebaseConfig.apiKey) {
        return firebaseConfig.apiKey;
    }

  } catch (e) {
    console.warn("Error reading API Key:", e);
  }
  return "MISSING_API_KEY";
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

const fileToGenerativePart = (base64Data: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64Data.split(',')[1],
      mimeType,
    },
  };
};

export const analyzeEquipmentCondition = async (photoB64: string, prompt: string): Promise<string> => {
  try {
    const imagePart = fileToGenerativePart(photoB64, 'image/jpeg');
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, { text: prompt }] },
    });
    return response.text || "No se pudo analizar la imagen.";
  } catch (error) {
    console.error("Error analyzing image:", error);
    return "No se pudo completar el análisis IA. Verifique la conexión o la clave API.";
  }
};

export const readInventoryLabel = async (photoB64: string): Promise<string> => {
  try {
    const imagePart = fileToGenerativePart(photoB64, 'image/jpeg');
    const prompt = `
      Analiza esta imagen de una etiqueta de inventario o rótulo de activo fijo (como las del SENA).
      Tu tarea es identificar y extraer ÚNICAMENTE la secuencia numérica principal que corresponde al código de inventario o número de placa.
      
      Reglas:
      1. Busca secuencias largas de dígitos (usualmente debajo de un código de barras).
      2. Ignora texto como "SERVICIO NACIONAL DE APRENDIZAJE", "SENA", "BOGOTA", etc.
      3. Si hay varios números, prefiere el que está más cerca del código de barras.
      4. Retorna SOLAMENTE los dígitos numéricos (ej: 101001130388). No añadas palabras, ni etiquetas, ni markdown.
      5. Si no encuentras ningún número claro, retorna "NO_FOUND".
    `;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, { text: prompt }] },
    });
    
    const text = (response.text || "").trim().replace(/[^0-9]/g, '');
    return text || "NO_FOUND";
  } catch (error) {
    console.error("Error reading label:", error);
    return "ERROR";
  }
};

export const generateLoanReportAnalysis = async (loanData: any[]): Promise<string> => {
  try {
    const prompt = `
      Analiza los siguientes datos de préstamos de nuestro MediaLab. Los datos están en formato JSON.
      Data: ${JSON.stringify(loanData, null, 2)}

      Basado en estos datos, proporciona un resumen que cubra los siguientes puntos:
      1. ¿Cuáles son los artículos que se prestan con más frecuencia?
      2. ¿Existen patrones visibles en la actividad de préstamos (por ejemplo, días específicos, artículos populares)?
      3. Destaca cualquier problema potencial, como equipos que se prestan con frecuencia y que podrían necesitar mantenimiento pronto.
      4. Proporciona una sugerencia práctica para mejorar nuestro proceso de gestión de equipos.
      
      Formatea la respuesta en puntos claros y concisos.
    `;
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: prompt
    });
    return response.text || "No se pudo generar el análisis.";
  } catch (error) {
    console.error("Error generating report analysis:", error);
    return "Error al generar el análisis con IA para el reporte.";
  }
};

export const generateIdealSetupImage = async (prompt: string, aspectRatio: string): Promise<string | null> => {
  try {
    const fullPrompt = `Una fotografía ilustrativa y profesional que muestra una configuración de equipo ideal para: "${prompt}". La escena debe ser limpia, bien iluminada y mostrar el equipo necesario con claridad.`;
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: fullPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
      },
    });
    // @ts-ignore
    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};

export const generateMaintenanceSuggestions = async (loans: LoanRecord[], equipment: Equipment[]): Promise<MaintenanceSuggestion[]> => {
    if (loans.length === 0) return [];
    try {
        const usageData = equipment.map(e => {
            const itemLoans = loans.filter(l => l.equipmentId === e.id);
            const loanCount = itemLoans.length;
            return {
                id: e.id,
                name: e.description, // Fixed: Use description as name was removed
                loanCount,
            };
        }).filter(e => e.loanCount > 0);

        const prompt = `
          Eres un experto en gestión de inventario de tecnología del SENA.
          
          Analiza los siguientes datos de frecuencia de préstamos:
          ${JSON.stringify(usageData, null, 2)}
          
          Identifica los 3 equipos "que se prestan con más frecuencia".
          
          Para cada uno de estos equipos de alto uso:
          1. Sugiere una **acción preventiva específica** (ej: "Limpieza profunda de ventiladores", "Verificación de estado de batería", "Ajuste de tornillería", "Limpieza de lente con paño microfibra").
          2. Justifica brevemente la acción basándote en el desgaste natural por uso frecuente.
          
          Retorna ÚNICAMENTE un JSON Array.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            equipmentId: { type: Type.STRING },
                            equipmentName: { type: Type.STRING },
                            suggestion: { type: Type.STRING }
                        },
                        required: ["equipmentId", "equipmentName", "suggestion"]
                    }
                }
            }
        });
        
        const jsonText = (response.text || "[]").trim();
        return JSON.parse(jsonText) as MaintenanceSuggestion[];

    } catch (error) {
        console.error("Error generating maintenance suggestions:", error);
        return [];
    }
};
