
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configuración con valores por defecto seguros para evitar crash por process.env
const firebaseConfig = {
  apiKey: "b537fab27559c972d7bd5924acf7edbb62f6ef2c", // Placeholder ID
  authDomain: "gestor-medialab-sena.firebaseapp.com",
  projectId: "gestor-medialab-sena",
  storageBucket: "gestor-medialab-sena.appspot.com",
  messagingSenderId: "366861561386",
  appId: "1:366861561386:web:placeholder_id" 
};

let app;
let dbInstance;
let authInstance;

try {
  // Inicializar Firebase de manera segura
  app = initializeApp(firebaseConfig);
  dbInstance = getFirestore(app);
  authInstance = getAuth(app);
} catch (error) {
  console.warn("Firebase could not be initialized (Offline Mode will be used):", error);
  // No re-lanzamos el error para permitir que la app cargue en modo offline
}

export const db = dbInstance;
export const auth = authInstance;
