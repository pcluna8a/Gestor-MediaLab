import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
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

let app: ReturnType<typeof initializeApp> | undefined;
let dbInstance: ReturnType<typeof initializeFirestore> | undefined;
let authInstance: ReturnType<typeof getAuth> | undefined;
let functionsInstance: ReturnType<typeof getFunctions> | undefined;

try {
  app = initializeApp(firebaseConfig);

  // Use modern persistence API (replaces deprecated enableIndexedDbPersistence)
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });

  authInstance = getAuth(app);
  functionsInstance = getFunctions(app);
} catch (error) {
  console.warn("Firebase could not be initialized (Offline Mode will be used):", error);
}

export const db = dbInstance;
export const auth = authInstance;
export const functions = functionsInstance;
