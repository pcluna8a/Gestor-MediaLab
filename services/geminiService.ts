
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

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
    return response.text;
  } catch (error) {
    console.error("Error analyzing image:", error);
    return "Error al analizar el estado de la imagen.";
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
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
      }
    });
    return response.text;
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
    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};