
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configuración de Firebase proporcionada por el usuario
export const firebaseConfig = {
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

try {
  app = initializeApp(firebaseConfig);
  dbInstance = getFirestore(app);
  authInstance = getAuth(app);
} catch (error) {
  console.error("Error inicializando Firebase:", error);
}

export const db = dbInstance;
export const auth = authInstance;
