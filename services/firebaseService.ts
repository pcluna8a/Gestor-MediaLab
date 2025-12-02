
import { 
    collection, 
    updateDoc, 
    doc, 
    deleteDoc, 
    onSnapshot, 
    query, 
    limit, 
    getDocs, 
    enableNetwork, 
    disableNetwork, 
    setDoc, 
    writeBatch, 
    getDoc 
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { db, auth } from "../firebaseConfig";
import { User, Equipment, LoanRecord, EquipmentStatus, AppConfig } from "../types";
import { INITIAL_USERS } from "../constants";
import { DEFAULT_EQUIPMENT } from "./initialData";

let isOfflineMode = false;
let isAuthenticating = false; // Flag to prevent Auth Loops
let seedAttempted = false;    // Flag to prevent repeated Seed attempts
let lastAuthAttempt = 0;      // Timestamp for throttling auth

export const hashPassword = async (password: string): Promise<string> => {
    if (!crypto || !crypto.subtle) {
        console.warn("Crypto API not available (Non-secure context). Using fallback hash.");
        return btoa(password); // Simple fallback for dev/insecure contexts
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const ensureAuth = async () => {
    if (!auth) return;
    if (!auth.currentUser) {
        try {
            console.log("Ensuring authentication for write operation...");
            await signInAnonymously(auth);
        } catch (e: any) {
            // FIX: Allow proceeding if Anonymous auth is restricted/disabled (common config issue)
            // Also handle rate limiting to prevent crashes
            if (e.code === 'auth/admin-restricted-operation' || 
                e.code === 'auth/operation-not-allowed' ||
                e.code === 'auth/too-many-requests') {
                 console.warn(`Auth warning: ${e.code}. Proceeding unauthenticated.`);
                 return;
            }
            console.warn("Ad-hoc authentication failed:", e.message);
            throw new Error(`Authentication failed: ${e.message}`);
        }
    }
};

export const initializeCloudDatabase = async () => {
    if (!db) return;
    
    // OPTIMIZATION: Check seed status first to avoid unnecessary auth calls on repeated checks
    if (seedAttempted) return;

    // Ensure auth before seeding to prevent permission errors
    await ensureAuth();

    seedAttempted = true;

    try {
        const equipmentRef = collection(db, 'equipment');
        
        console.log("Sincronización automática de usuarios desactivada. Usar panel administrativo.");

        // Seed Equipment if empty
        try {
            const equipmentSnap = await getDocs(query(equipmentRef, limit(1)));
            if (equipmentSnap.empty) {
                console.log("Seeding Equipment...");
                for (const eq of DEFAULT_EQUIPMENT) {
                    await setDoc(doc(db, 'equipment', eq.id), eq);
                }
            }
        } catch (e) { /* Ignore read error */ }

    } catch (e: any) {
        if (e.code !== 'permission-denied' && e.code !== 'unavailable') {
            console.error("Error seeding database:", e.message);
        }
    }
};

/**
 * Función activada manualmente por el SUPER-ADMIN para forzar la subida de datos locales
 * y corregir problemas de permisos o datos faltantes.
 * Verifica conexión, roles y contactos.
 */
export const forceCloudSync = async (onProgress?: (msg: string) => void) => {
    if (!db) return { success: false, message: "No hay conexión con Firebase configurada." };

    if (onProgress) onProgress("Verificando conectividad...");
    
    // 1. Verify basic connectivity with feedback
    const isOnline = await checkCloudConnection();
    if (!isOnline) {
        return { success: false, message: "Sin conexión a internet o base de datos inaccesible." };
    }

    // UX Delay to let user see "Checking connection"
    if (onProgress) onProgress("Conexión estable. Iniciando...");
    await new Promise(r => setTimeout(r, 500));

    try {
        if (onProgress) onProgress("Autenticando...");
        await ensureAuth();
        
        console.log("Iniciando verificación y sincronización forzada...");
        let usersUpdated = 0;
        let equipmentUpdated = 0;
        let errors: string[] = [];

        // 2. Forzar subida de Usuarios (Iteración Individual para tolerancia a fallos)
        const totalUsers = INITIAL_USERS.length;
        for (let i = 0; i < totalUsers; i++) {
            const user = INITIAL_USERS[i];
            if (onProgress) onProgress(`Usuarios: ${i + 1}/${totalUsers}`);
            
            try {
                const userDocRef = doc(db, 'users', user.id);
                let passwordHash = undefined;
                if (user.initialPassword) {
                    passwordHash = await hashPassword(user.initialPassword);
                }
                
                // Preparamos los datos a sincronizar
                const userData: any = { ...user };
                if (passwordHash) userData.passwordHash = passwordHash;
                delete userData.initialPassword; 

                // Usamos merge: true para actualizar roles, emails, UIDs, categorías
                await setDoc(userDocRef, userData, { merge: true });
                usersUpdated++;
            } catch (e: any) {
                console.warn(`Error al sincronizar usuario ${user.name}:`, e.message);
                errors.push(`User ${user.id}`);
            }
        }

        // 3. Forzar subida de Equipos (Batch para eficiencia)
        try {
            const BATCH_SIZE = 400;
            const totalEq = DEFAULT_EQUIPMENT.length;
            
            if (onProgress) onProgress(`Iniciando carga de equipos...`);

            for (let i = 0; i < totalEq; i += BATCH_SIZE) {
                const end = Math.min(i + BATCH_SIZE, totalEq);
                if (onProgress) onProgress(`Equipos: ${end}/${totalEq}`);

                const batch = writeBatch(db);
                const chunk = DEFAULT_EQUIPMENT.slice(i, i + BATCH_SIZE);
                chunk.forEach(eq => {
                    const ref = doc(db, 'equipment', eq.id);
                    batch.set(ref, eq, { merge: true });
                });
                await batch.commit();
                equipmentUpdated += chunk.length;
            }
        } catch (e: any) {
            console.error("Error en carga batch de equipos:", e);
            errors.push("Carga de Equipos (Batch)");
        }
        
        if (onProgress) onProgress("Finalizando...");

        let msg = `Verificación completa. ${usersUpdated} usuarios sincronizados.`;
        if (equipmentUpdated > 0) msg += ` ${equipmentUpdated} equipos verificados.`;
        
        if (errors.length > 0) {
            msg += ` Nota: Hubo errores en ${errors.length} elementos (posiblemente permisos).`;
            console.error("Errores de sincronización:", errors);
        }

        return { 
            success: errors.length === 0, 
            message: msg 
        };

    } catch (error: any) {
        console.error("Force sync critical error:", error.message || error);
        return { success: false, message: error.message || "Error crítico durante la sincronización." };
    }
};

export const checkCloudConnection = async (): Promise<boolean> => {
    if (!db || !auth) {
        isOfflineMode = true;
        return false;
    }

    try {
        // Intento de autenticación
        if (!auth.currentUser) {
            
            if (isAuthenticating) return false; // Prevent Loop
            
            // Throttle Auth Attempts (30 seconds cooldown)
            const now = Date.now();
            if (now - lastAuthAttempt < 30000) {
                // Throttle
            } else {
                lastAuthAttempt = now;
                isAuthenticating = true;
                try {
                    await signInAnonymously(auth);
                } catch (authError: any) {
                    if (authError.code === 'auth/admin-restricted-operation') {
                        console.info("Info: Auth Anónimo no habilitado. Verificando acceso público...");
                    } else if (authError.code === 'auth/too-many-requests') {
                        console.warn("Info: Throttling auth requests.");
                    } else {
                        console.warn("Auth check skipped:", authError.code);
                    }
                }
                isAuthenticating = false;
            }
        }

        // Ejecutamos la sincronización de inicialización inmediatamente para unificar datos
        initializeCloudDatabase().catch(err => console.error("Initialization warning:", err));

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
        const connectionPromise = getDocs(query(collection(db, 'users'), limit(1))); 
        
        await Promise.race([connectionPromise, timeoutPromise]);
        
        if (isOfflineMode) {
            await enableNetwork(db);
        }

        isOfflineMode = false;
        return true;
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            isOfflineMode = false;
            return true;
        } 
        
        if (!isOfflineMode) {
             isOfflineMode = true;
             try { await disableNetwork(db); } catch(e) {}
        }
        return false;
    }
};

export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
    if (!db) return () => {};
    
    const q = query(collection(db, collectionName));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        callback(data);
    }, (error) => {
        if (error.code !== 'permission-denied' && error.code !== 'failed-precondition') {
            console.error(`Subscription error (${collectionName}):`, error.code);
        }
    });
};

export const subscribeToAppConfig = (callback: (config: AppConfig | null) => void) => {
    if (!db) return () => {};
    const docRef = doc(db, 'config', 'global_settings');
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data() as AppConfig);
        } else {
            callback(null);
        }
    }, (error) => {
        // Suppress errors
    });
};

export const uploadLogoToCloud = async (base64Data: string) => {
    try {
        if (!db) return;
        await ensureAuth();
        await setDoc(doc(db, 'config', 'global_settings'), { logoBase64: base64Data }, { merge: true });
    } catch (error) {
        console.error("Error uploading logo:", error);
        throw error;
    }
};

export const registerNewLoanInCloud = async (loan: LoanRecord) => {
    try {
        if (!db) throw new Error("No database connection");
        await ensureAuth();
        await setDoc(doc(db, 'loans', loan.id), loan);
        
        const eqRef = doc(db, 'equipment', loan.equipmentId);
        await updateDoc(eqRef, { status: EquipmentStatus.ON_LOAN });
        
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const registerReturnInCloud = async (loanId: string, equipmentId: string, returnData: any) => {
    try {
        if (!db) throw new Error("No database connection");
        await ensureAuth();
        
        const loanRef = doc(db, 'loans', loanId);
        await updateDoc(loanRef, {
            returnDate: new Date().toISOString(),
            returnConditionAnalysis: returnData.analysis,
            returnConcept: returnData.concept,
            returnStatus: returnData.status,
            returnPhotos: returnData.photos
        });

        const eqRef = doc(db, 'equipment', equipmentId);
        await updateDoc(eqRef, { status: EquipmentStatus.AVAILABLE });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const addUserToCloud = async (user: User) => {
    try {
        if (!db) return { success: false, message: "No database connection" };
        await ensureAuth();
        await setDoc(doc(db, 'users', user.id), user);
        return { success: true, message: "Usuario creado correctamente" };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
};

export const batchUploadUsers = async (userList: User[], onProgress?: (count: number, total: number) => void) => {
    if (!db) return { success: false, message: "No hay conexión a base de datos." };

    try {
        await ensureAuth();
        const BATCH_SIZE = 400; 
        const total = userList.length;
        let processed = 0;

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = userList.slice(i, i + BATCH_SIZE);

            for (const user of chunk) {
                const ref = doc(db, 'users', user.id);
                batch.set(ref, user, { merge: true }); 
            }

            await batch.commit();
            processed += chunk.length;
            if (onProgress) onProgress(processed, total);
        }

        return { success: true, message: `Se importaron ${processed} usuarios exitosamente.` };
    } catch (error: any) {
        if (error.code === 'permission-denied') {
             console.warn("Batch upload permission denied. Proceeding without cloud sync.");
             return { success: false, message: "Permisos insuficientes en la nube. (Modo Local)" };
        }
        console.error("Batch user upload error:", error.message || error.code);
        return { success: false, message: error.message };
    }
};

export const updateUserInCloud = async (user: User) => {
     try {
        if (!db) return;
        await ensureAuth();
        await setDoc(doc(db, 'users', user.id), user, { merge: true });
    } catch (error: any) {
        if (error.code !== 'permission-denied') {
            console.error("Error updating user:", error.message || error.code);
        }
    }
};

export const addEquipmentToCloud = async (item: Equipment) => {
    try {
        if (!db) return;
        await ensureAuth();
        await setDoc(doc(db, 'equipment', item.id), item);
    } catch (error) {
        console.error("Error adding equipment:", error);
    }
};

export const updateEquipmentInCloud = async (item: Equipment) => {
    try {
        if (!db) return { success: false, error: "No DB" };
        await ensureAuth();
        await setDoc(doc(db, 'equipment', item.id), item, { merge: true });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const deleteEquipmentInCloud = async (id: string) => {
    try {
        if (!db) return { success: false, error: "No DB" };
        await ensureAuth();
        await deleteDoc(doc(db, 'equipment', id));
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const updateEquipmentImageInCloud = async (id: string, url: string) => {
    try {
        if (!db) return;
        await ensureAuth();
        const eqRef = doc(db, 'equipment', id);
        await updateDoc(eqRef, { imageUrl: url });
    } catch (error) {
        console.error("Error updating image:", error);
    }
};

export const batchUploadEquipment = async (equipmentList: Equipment[], onProgress?: (count: number, total: number) => void) => {
    if (!db) return { success: false, message: "No hay conexión a base de datos." };

    try {
        await ensureAuth();
        const BATCH_SIZE = 400; 
        const total = equipmentList.length;
        let processed = 0;

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = equipmentList.slice(i, i + BATCH_SIZE);

            chunk.forEach(item => {
                const ref = doc(db, 'equipment', item.id);
                batch.set(ref, item);
            });

            await batch.commit();
            processed += chunk.length;
            if (onProgress) onProgress(processed, total);
        }

        return { success: true, message: `Se importaron ${processed} equipos exitosamente.` };
    } catch (error: any) {
        console.error("Batch upload error:", error);
        return { success: false, message: error.message };
    }
};

export const updateUserCredentials = async (userId: string, email: string, passwordHash: string) => {
    try {
        if (!db) return { success: false, error: "No DB connection" };
        
        await ensureAuth();

        const userRef = doc(db, 'users', userId);
        
        await setDoc(userRef, { 
            email: email, 
            passwordHash: passwordHash,
            forcePasswordChange: false,
            id: userId 
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        if (error.code === 'permission-denied') {
             console.warn(`Permission denied updating credentials for ${userId}. Proceeding locally.`);
             return { success: true };
        }

        console.error("Update credentials failed:", error.message || error.code);
        return { success: false, error: error.message };
    }
};
