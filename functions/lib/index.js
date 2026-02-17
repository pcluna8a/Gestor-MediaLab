"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMaintenanceSuggestions = exports.generateLoanReportAnalysis = exports.readInventoryLabel = exports.analyzeEquipmentCondition = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const genai_1 = require("@google/genai");
const params_1 = require("firebase-functions/params");
admin.initializeApp();
// Define secret for Gemini API Key
const geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
const getAiClient = () => {
    // Access the secret value
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
        throw new Error("Missing Gemini API Key in Secrets.");
    }
    return new genai_1.GoogleGenAI({ apiKey });
};
// --- Helpers ---
const ensureAuthenticated = (context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
};
const ensureInstructor = async (context) => {
    ensureAuthenticated(context);
};
// --- Functions ---
// Note: We must add { secrets: [geminiApiKey] } to the options of each function that needs the key
exports.analyzeEquipmentCondition = functions.runWith({ secrets: [geminiApiKey] }).https.onCall(async (data, context) => {
    ensureAuthenticated(context);
    const { photoB64, prompt } = data;
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { data: photoB64.split(',')[1], mimeType: 'image/jpeg' } },
                    { text: prompt }
                ]
            },
        });
        return { text: response.text || "No se pudo analizar la imagen." };
    }
    catch (error) {
        console.error("Error in analyzeEquipmentCondition:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
exports.readInventoryLabel = functions.runWith({ secrets: [geminiApiKey] }).https.onCall(async (data, context) => {
    ensureAuthenticated(context);
    const { photoB64 } = data;
    try {
        const ai = getAiClient();
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
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { data: photoB64.split(',')[1], mimeType: 'image/jpeg' } },
                    { text: prompt }
                ]
            },
        });
        const text = (response.text || "").trim().replace(/[^0-9]/g, '');
        return { text: text || "NO_FOUND" };
    }
    catch (error) {
        console.error("Error in readInventoryLabel:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
exports.generateLoanReportAnalysis = functions.runWith({ secrets: [geminiApiKey] }).https.onCall(async (data, context) => {
    ensureInstructor(context);
    const { loanData } = data;
    try {
        const ai = getAiClient();
        const prompt = `
          Analiza los siguientes datos de préstamos de nuestro MediaLab.
          Data: ${JSON.stringify(loanData, null, 2)}
          ...
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return { text: response.text || "No se pudo generar el análisis." };
    }
    catch (error) {
        console.error("Error in generateLoanReportAnalysis:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
exports.generateMaintenanceSuggestions = functions.runWith({ secrets: [geminiApiKey] }).https.onCall(async (data, context) => {
    ensureInstructor(context);
    const { usageData } = data;
    try {
        const ai = getAiClient();
        const prompt = `
          Eres un experto en gestión de inventario...
          Analiza...
          ${JSON.stringify(usageData, null, 2)}
          ...
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return { text: response.text || "[]" };
    }
    catch (error) {
        console.error("Error in generateMaintenanceSuggestions:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=index.js.map