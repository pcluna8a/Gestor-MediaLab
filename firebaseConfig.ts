import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDNbMkUW0VZibUhpZChtAnCWD1qMZ3Hllw",
  authDomain: "gestor-medialab-sena.firebaseapp.com",
  projectId: "gestor-medialab-sena",
  storageBucket: "gestor-medialab-sena.firebasestorage.app",
  messagingSenderId: "366861561386",
  appId: "1:366861561386:web:4ddab8b9ba88e7edfa9d53"
};

let app;
let dbInstance;
let authInstance;
let functionsInstance;

try {
  // Inicializar Firebase de manera segura
  app = initializeApp(firebaseConfig);
  dbInstance = getFirestore(app);
  authInstance = getAuth(app);
  functionsInstance = getFunctions(app);
} catch (error) {
  console.warn("Firebase could not be initialized (Offline Mode will be used):", error);
  // No re-lanzamos el error para permitir que la app cargue en modo offline
}

export const db = dbInstance;
export const auth = authInstance;
export const functions = functionsInstance;
