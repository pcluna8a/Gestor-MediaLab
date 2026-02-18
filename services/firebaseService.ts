
import { db, auth } from '../firebaseConfig';
import {
    collection,
    doc,
    setDoc,
    getDocs,
    onSnapshot,
    query,
    runTransaction,
    writeBatch,
    deleteDoc,
    updateDoc,
    limit,
    where
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { Equipment, LoanRecord, User, EquipmentStatus, Role } from '../types';
import { DEFAULT_EQUIPMENT } from './initialData';
import { INITIAL_USERS } from '../constants';

// --- CONSTANTES ---
const COLL_EQUIPMENT = 'equipment';
const COLL_LOANS = 'loans';
const COLL_USERS = 'users';

// --- ESTADO DE CONEXIÓN ---
let isOfflineMode = false;
const localListeners: Record<string, ((data: any[]) => void)[]> = {
    [COLL_EQUIPMENT]: [],
    [COLL_LOANS]: [],
    [COLL_USERS]: []
};

// --- SEGURIDAD (HASHING) ---
export const hashPassword = async (password: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};

// --- MOCK LOCAL DB HELPERS ---
const getLocalData = (key: string): any[] => {
    const data = localStorage.getItem(`medialab_${key}`);
    return data ? JSON.parse(data) : [];
};

const setLocalData = (key: string, data: any[]) => {
    localStorage.setItem(`medialab_${key}`, JSON.stringify(data));
    notifyLocalListeners(key, data);
};

const notifyLocalListeners = (key: string, data: any[]) => {
    if (localListeners[key]) {
        localListeners[key].forEach(cb => cb(data));
    }
};

const initLocalDataIfNeeded = () => {
    if (getLocalData(COLL_EQUIPMENT).length === 0) setLocalData(COLL_EQUIPMENT, DEFAULT_EQUIPMENT);
    if (getLocalData(COLL_USERS).length === 0) setLocalData(COLL_USERS, INITIAL_USERS);
};

// --- EVENT LISTENER PARA SINCRONIZACIÓN ENTRE PESTAÑAS ---
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key && event.key.startsWith('medialab_')) {
            const collectionName = event.key.replace('medialab_', '');
            if (localListeners[collectionName]) {
                const newData = event.newValue ? JSON.parse(event.newValue) : [];
                notifyLocalListeners(collectionName, newData);
            }
        }
    });
}

// --- AUTH HELPER ---
import {
    signInWithEmailAndPassword,
    signOut,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    User as FirebaseUser
} from "firebase/auth";

// --- NUEVOS MÉTODOS DE AUTENTICACIÓN ---

// Login para Instructores (Email/Password)
export const loginInstructor = async (email: string, password: string) => {
    if (!auth) return { success: false, error: "Firebase Auth no inicializado" };
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error: any) {
        console.error("Login error:", error.code, error.message);
        return { success: false, error: error.message };
    }
};

// Login para Aprendices (Anónimo + Registro en Firestore si es nuevo)
export const loginStudent = async (id: string, category: string, name: string = 'Usuario') => {
    if (!auth || !db) return { success: false, error: "Servicios no inicializados" };
    try {
        // 1. Autenticación Anónima para tener sesión segura
        await signInAnonymously(auth);

        // 2. Buscar o Crear usuario en Firestore
        const userRef = doc(db, COLL_USERS, id);
        const userSnap = await getDocs(query(collection(db, COLL_USERS), where('id', '==', id), limit(1))); // Buscamos por campo ID interno, no UID de Auth

        let userData: User;

        if (!userSnap.empty) {
            // Usuario ya existe
            userData = userSnap.docs[0].data() as User;

            // Prepare updates
            const updates: any = {};

            // Actualizar categoría si cambió
            if (userData.category !== category) {
                updates.category = category;
                userData.category = category as any;
            }

            // Actualizar UID si falta (para recuperación de sesión)
            if (!userData.uid && auth.currentUser?.uid) {
                updates.uid = auth.currentUser.uid;
                userData.uid = auth.currentUser.uid;
            }

            if (Object.keys(updates).length > 0) {
                await updateDoc(userSnap.docs[0].ref, updates);
            }
        } else {
            // Crear nuevo usuario estudiante
            userData = {
                id: id,
                uid: auth.currentUser?.uid, // Store the Auth UID for session recovery
                name: name,
                role: Role.USUARIO_MEDIALAB,
                category: category as any
            };
            await setDoc(userRef, userData);
        }

        return { success: true, user: userData };
    } catch (error: any) {
        console.error("Student login error:", error);
        return { success: false, error: error.message };
    }
};

export const logoutUser = async () => {
    if (!auth) return;
    try {
        await signOut(auth);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

const ensureAuth = async () => {
    // Ya no necesitamos forzar login anónimo automáticamente si vamos a tener login explícito
    // Pero para modo offline/lectura pública podría ser útil.
    // Lo mantenemos simple: Si no hay usuario, las reglas de seguridad bloquearán escrituras.
    return;
};

// --- FUNCIONES HIBRIDAS ---

export const checkCloudConnection = async (): Promise<boolean> => {
    if (!db) {
        console.warn("Database instance not initialized. Switching to Offline Mode.");
        isOfflineMode = true;
        initLocalDataIfNeeded();
        return false;
    }

    try {
        await ensureAuth();

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
        const connectionPromise = getDocs(query(collection(db, 'users'), limit(1)));

        await Promise.race([connectionPromise, timeoutPromise]);

        isOfflineMode = false;
        return true;
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn("Cloud Connection: Permission Denied. Switching to Offline Mode.");
            isOfflineMode = true;
            initLocalDataIfNeeded();
            return false;
        }

        if (error.code === 'unavailable' || error.message === 'Timeout') {
            console.warn("Cloud Connection Failed (Network):", error.message);
            isOfflineMode = true;
            initLocalDataIfNeeded();
            return false;
        }
        isOfflineMode = false;
        return true;
    }
};

export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
    if (isOfflineMode || !db) {
        const initialData = getLocalData(collectionName);
        callback(initialData);

        const listener = (data: any[]) => callback(data);
        localListeners[collectionName].push(listener);

        return () => {
            localListeners[collectionName] = localListeners[collectionName].filter(l => l !== listener);
        };
    }

    try {
        const q = query(collection(db, collectionName));
        const unsubscribe = onSnapshot(q,
            (querySnapshot) => {
                const data: any[] = [];
                querySnapshot.forEach((doc) => {
                    data.push(doc.data());
                });
                callback(data);
            },
            (error) => {
                if (error.code === 'permission-denied') {
                    console.warn(`Firestore: Permission denied for ${collectionName}. Using local data.`);
                    if (!isOfflineMode) {
                        isOfflineMode = true;
                        initLocalDataIfNeeded();
                    }
                } else {
                    console.error(`Firestore Error on ${collectionName}:`, error.code || error.message);
                    if (error.code === 'unavailable') {
                        if (!isOfflineMode) {
                            isOfflineMode = true;
                            initLocalDataIfNeeded();
                        }
                    }
                }
                const localData = getLocalData(collectionName);
                callback(localData);
                const listener = (data: any[]) => callback(data);
                localListeners[collectionName].push(listener);
            }
        );

        return () => {
            unsubscribe();
        };
    } catch (e) {
        console.error("Error creating snapshot listener:", e);
        const localData = getLocalData(collectionName);
        callback(localData);
        return () => { };
    }
};

export const registerNewLoanInCloud = async (loan: LoanRecord) => {
    if (isOfflineMode || !db) {
        const loans = getLocalData(COLL_LOANS);
        const equipment = getLocalData(COLL_EQUIPMENT);

        const eqIndex = equipment.findIndex(e => e.id === loan.equipmentId);
        if (eqIndex >= 0 && equipment[eqIndex].status === EquipmentStatus.ON_LOAN) {
            return { success: false, error: "El equipo ya figura como prestado en la base de datos local." };
        }

        loans.push({ ...loan, loanDate: loan.loanDate instanceof Date ? loan.loanDate.toISOString() : loan.loanDate });
        if (eqIndex >= 0) equipment[eqIndex].status = EquipmentStatus.ON_LOAN;

        setLocalData(COLL_LOANS, loans);
        setLocalData(COLL_EQUIPMENT, equipment);
        return { success: true };
    }

    try {
        await ensureAuth();
        await runTransaction(db, async (transaction) => {
            const equipmentRef = doc(db!, COLL_EQUIPMENT, loan.equipmentId);
            const loanRef = doc(db!, COLL_LOANS, loan.id);

            const equipmentDoc = await transaction.get(equipmentRef);
            if (!equipmentDoc.exists()) throw "El equipo no existe en la base de datos.";

            const currentStatus = equipmentDoc.data().status;
            if (currentStatus === EquipmentStatus.ON_LOAN) {
                throw "El equipo ya ha sido prestado a otro usuario hace un momento.";
            }

            const loanData = {
                ...loan,
                loanDate: loan.loanDate instanceof Date ? loan.loanDate.toISOString() : loan.loanDate,
                returnDate: null
            };

            transaction.set(loanRef, loanData);
            transaction.update(equipmentRef, { status: EquipmentStatus.ON_LOAN });
        });
        return { success: true };
    } catch (e: any) {
        const msg = e.message || String(e);
        if (e.code === 'permission-denied') return { success: false, error: "Permisos insuficientes." };
        console.error("Transaction failed:", msg);
        return { success: false, error: msg };
    }
};

export const registerReturnInCloud = async (
    loanId: string,
    equipmentId: string,
    returnData: { concept: string, status: string, photos: string[], analysis: string }
) => {
    if (isOfflineMode || !db) {
        const loans = getLocalData(COLL_LOANS);
        const equipment = getLocalData(COLL_EQUIPMENT);

        const loanIndex = loans.findIndex(l => l.id === loanId);
        const eqIndex = equipment.findIndex(e => e.id === equipmentId);

        if (loanIndex >= 0) {
            loans[loanIndex] = {
                ...loans[loanIndex],
                returnDate: new Date().toISOString(),
                returnConcept: returnData.concept,
                returnStatus: returnData.status,
                returnPhotos: returnData.photos,
                returnConditionAnalysis: returnData.analysis
            };
            setLocalData(COLL_LOANS, loans);
        }

        if (eqIndex >= 0) {
            equipment[eqIndex].status = EquipmentStatus.AVAILABLE;
            setLocalData(COLL_EQUIPMENT, equipment);
        }
        return { success: true };
    }

    try {
        await ensureAuth();
        await runTransaction(db, async (transaction) => {
            const equipmentRef = doc(db!, COLL_EQUIPMENT, equipmentId);
            const loanRef = doc(db!, COLL_LOANS, loanId);

            transaction.update(loanRef, {
                returnDate: new Date().toISOString(),
                returnConcept: returnData.concept,
                returnStatus: returnData.status,
                returnPhotos: returnData.photos,
                returnConditionAnalysis: returnData.analysis
            });
            transaction.update(equipmentRef, { status: EquipmentStatus.AVAILABLE });
        });
        return { success: true };
    } catch (e: any) {
        const msg = e.message || String(e);
        if (e.code === 'permission-denied') return { success: false, error: "Permisos insuficientes." };
        console.error("Return transaction failed:", msg);
        return { success: false, error: msg };
    }
};

export const addUserToCloud = async (user: User) => {
    if (user.role === Role.INSTRUCTOR_MEDIALAB && !user.passwordHash) {
        user.passwordHash = await hashPassword(user.id);
        user.forcePasswordChange = true;
    }

    if (isOfflineMode || !db) {
        const users = getLocalData(COLL_USERS);
        const index = users.findIndex(u => u.id === user.id);
        if (index >= 0) {
            users[index] = user; // Actualizar si existe
        } else {
            users.push(user);
        }
        setLocalData(COLL_USERS, users);
        return;
    }
    try {
        await ensureAuth();
        await setDoc(doc(db, COLL_USERS, user.id), user);
    } catch (e: any) {
        console.error("Add user error:", e.message);
    }
};

export const updateUserInCloud = async (user: User) => {
    return addUserToCloud(user); // Reutilizamos lógica de setDoc/merge implícito o reemplazo
};

export const updateUserCredentials = async (userId: string, email: string, newPasswordHash: string) => {
    if (isOfflineMode || !db) {
        const users = getLocalData(COLL_USERS);
        const idx = users.findIndex(u => u.id === userId);
        if (idx >= 0) {
            users[idx].email = email;
            users[idx].passwordHash = newPasswordHash;
            users[idx].forcePasswordChange = false;
            setLocalData(COLL_USERS, users);
            return { success: true };
        }
        return { success: false, error: 'Usuario no encontrado localmente' };
    }

    try {
        await ensureAuth();
        await updateDoc(doc(db, COLL_USERS, userId), {
            email: email,
            passwordHash: newPasswordHash,
            forcePasswordChange: false
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const addEquipmentToCloud = async (item: Equipment) => {
    if (isOfflineMode || !db) {
        const equipment = getLocalData(COLL_EQUIPMENT);
        equipment.push(item);
        setLocalData(COLL_EQUIPMENT, equipment);
        return;
    }
    try {
        await ensureAuth();
        await setDoc(doc(db, COLL_EQUIPMENT, item.id), item);
    } catch (e: any) {
        console.error("Add equipment error:", e.message);
    }
};

export const updateEquipmentImageInCloud = async (id: string, url: string) => {
    if (isOfflineMode || !db) {
        const equipment = getLocalData(COLL_EQUIPMENT);
        const index = equipment.findIndex(e => e.id === id);
        if (index >= 0) {
            equipment[index].imageUrl = url;
            setLocalData(COLL_EQUIPMENT, equipment);
        }
        return;
    }
    try {
        await ensureAuth();
        await setDoc(doc(db, COLL_EQUIPMENT, id), { imageUrl: url }, { merge: true });
    } catch (e: any) {
        console.error("Update image error:", e.message);
    }
};

export const updateEquipmentInCloud = async (updatedItem: Equipment) => {
    if (isOfflineMode || !db) {
        const equipment = getLocalData(COLL_EQUIPMENT);
        const index = equipment.findIndex(e => e.id === updatedItem.id);
        if (index >= 0) {
            equipment[index] = updatedItem;
            setLocalData(COLL_EQUIPMENT, equipment);
        }
        return { success: true };
    }
    try {
        await ensureAuth();
        await updateDoc(doc(db, COLL_EQUIPMENT, updatedItem.id), { ...updatedItem });
        return { success: true };
    } catch (e: any) {
        const msg = e.message || String(e);
        if (e.code === 'permission-denied') return { success: false, error: "Permisos insuficientes." };
        console.error("Error updating equipment:", msg);
        return { success: false, error: msg };
    }
};

export const deleteEquipmentInCloud = async (itemId: string) => {
    if (isOfflineMode || !db) {
        let equipment = getLocalData(COLL_EQUIPMENT);
        equipment = equipment.filter(e => e.id !== itemId);
        setLocalData(COLL_EQUIPMENT, equipment);
        return { success: true };
    }
    try {
        await ensureAuth();
        await deleteDoc(doc(db, COLL_EQUIPMENT, itemId));
        return { success: true };
    } catch (e: any) {
        const msg = e.message || String(e);
        if (e.code === 'permission-denied') return { success: false, error: "Permisos insuficientes." };
        console.error("Error deleting equipment:", msg);
        return { success: false, error: msg };
    }
};

export const initializeCloudDatabase = async () => {
    if (isOfflineMode || !db) return false;
    try {
        await ensureAuth();
        const equipmentSnapshot = await getDocs(query(collection(db, COLL_EQUIPMENT), limit(1)));
        if (equipmentSnapshot.empty) return false;
        return true;
    } catch (e) {
        // Suppress permission-denied log here as it's likely from checkCloudConnection fallback
    }
    return false;
};

export const seedCloudDatabase = async (onProgress?: (message: string, percentage: number) => void) => {
    if (isOfflineMode || !db) {
        return { success: false, message: "No hay conexión a la nube para realizar la migración." };
    }

    try {
        await ensureAuth();
        const allOperations: { type: 'set', ref: any, data: any }[] = [];

        // 1. Equipos
        const localEquipmentRaw = getLocalData(COLL_EQUIPMENT);
        const mergedEquipment = [...DEFAULT_EQUIPMENT];
        localEquipmentRaw.forEach(localEq => {
            if (!mergedEquipment.find(me => me.id === localEq.id)) {
                mergedEquipment.push(localEq);
            }
        });

        mergedEquipment.forEach(eq => {
            allOperations.push({
                type: 'set',
                ref: doc(db!, COLL_EQUIPMENT, eq.id),
                data: eq
            });
        });

        // 2. Usuarios con Seguridad
        const localUsersRaw = getLocalData(COLL_USERS);
        const mergedUsers = [...INITIAL_USERS];

        localUsersRaw.forEach(localUser => {
            if (!mergedUsers.find(mu => mu.id === localUser.id)) {
                mergedUsers.push(localUser);
            }
        });

        // Proceso de Hashing para Instructores Iniciales
        for (let i = 0; i < mergedUsers.length; i++) {
            const u = mergedUsers[i];
            if (u.role === Role.INSTRUCTOR_MEDIALAB && !u.passwordHash) {
                u.passwordHash = await hashPassword(u.id);
                u.forcePasswordChange = true;
            }
            allOperations.push({
                type: 'set',
                ref: doc(db!, COLL_USERS, u.id),
                data: u
            });
        }

        const totalDocs = allOperations.length;
        const BATCH_SIZE = 400;
        const chunks = [];

        for (let i = 0; i < totalDocs; i += BATCH_SIZE) {
            chunks.push(allOperations.slice(i, i + BATCH_SIZE));
        }

        let processedCount = 0;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const batch = writeBatch(db);
            chunk.forEach(op => batch.set(op.ref, op.data));

            if (onProgress) onProgress(`Subiendo lote ${i + 1}...`, Math.round((processedCount / totalDocs) * 100));

            await batch.commit();
            processedCount += chunk.length;
        }

        return { success: true, message: `Migración completa con seguridad aplicada.` };

    } catch (error: any) {
        const msg = error.message || String(error);
        if (error.code === 'permission-denied') return { success: false, message: "Permisos insuficientes para migrar." };
        console.error("Error en migración:", msg);
        return { success: false, message: `Error crítico: ${msg}` };
    }
};
