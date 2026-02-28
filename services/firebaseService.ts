
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
// Firestore maneja internamente la persistencia y el modo offline.

// --- SEGURIDAD (HASHING) ---
export const hashPassword = async (password: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};

// --- AUTH HELPER ---
import {
    signInWithEmailAndPassword,
    signOut,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth";

// --- NUEVOS MÉTODOS DE AUTENTICACIÓN ---

// Reestablecer contraseña
export const sendPasswordReset = async (email: string) => {
    if (!auth) return { success: false, error: "Firebase Auth no inicializado" };
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error: any) {
        console.error("Reset password error:", error.code, error.message);
        return { success: false, error: error.message };
    }
};

// Login con Google
export const loginWithGoogle = async () => {
    if (!auth) return { success: false, error: "Firebase Auth no inicializado" };
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        return { success: true, user: result.user };
    } catch (error: any) {
        console.error("Google login error:", error.code, error.message);
        return { success: false, error: error.message };
    }
};

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

// Login para Aprendices/Usuarios (Email/Password + Registro en Firestore si es nuevo)
export const loginStudent = async (email: string, password: string, category: string, name: string = 'Usuario') => {
    if (!auth || !db) return { success: false, error: "Servicios no inicializados" };
    try {
        let userCredential;
        try {
            userCredential = await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            try {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
            } catch (createError: any) {
                if (createError.code === 'auth/email-already-in-use') {
                    return { success: false, error: "Contraseña incorrecta." };
                }
                return { success: false, error: `Error de autenticación: ${createError.message}` };
            }
        }

        const id = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        const userRef = doc(db, COLL_USERS, id);
        const userSnap = await getDocs(query(collection(db, COLL_USERS), where('email', '==', email), limit(1)));

        let userData: User;

        if (!userSnap.empty) {
            userData = userSnap.docs[0].data() as User;
            const updates: any = {};

            if (userData.category !== category) {
                updates.category = category;
                userData.category = category as any;
            }

            if (!userData.uid && auth.currentUser?.uid) {
                updates.uid = auth.currentUser.uid;
                userData.uid = auth.currentUser.uid;
            }

            if (!userData.email) {
                updates.email = email;
                userData.email = email;
            }

            if (Object.keys(updates).length > 0) {
                await updateDoc(userSnap.docs[0].ref, updates);
            }
        } else {
            userData = {
                id: id,
                uid: auth.currentUser?.uid,
                email: email,
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

// --- FUNCIONES DE ACCESO A DATOS ---

export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
    if (!db) return () => { };

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
            console.error(`Firestore Error on ${collectionName}:`, error.code || error.message);
        }
    );

    return unsubscribe;
};

export const registerNewLoanInCloud = async (loan: LoanRecord) => {
    if (!db) return { success: false, error: "Base de datos no disponible" };

    try {
        await runTransaction(db, async (transaction) => {
            const equipmentRef = doc(db!, COLL_EQUIPMENT, loan.equipmentId);
            const loanRef = doc(db!, COLL_LOANS, loan.id);

            const equipmentDoc = await transaction.get(equipmentRef);
            if (!equipmentDoc.exists()) throw new Error("El equipo no existe en la base de datos.");

            const currentStatus = equipmentDoc.data().status;
            if (currentStatus === EquipmentStatus.ON_LOAN) {
                throw new Error("El equipo ya ha sido prestado a otro usuario.");
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
        return { success: false, error: e.message || String(e) };
    }
};

export const registerReturnInCloud = async (
    loanId: string,
    equipmentId: string,
    returnData: { concept: string, status: string, photos: string[], analysis: string }
) => {
    if (!db) return { success: false, error: "Base de datos no disponible" };

    try {
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
        return { success: false, error: e.message || String(e) };
    }
};

export const addUserToCloud = async (user: User) => {
    if (!db) return;
    if (user.role === Role.INSTRUCTOR_MEDIALAB && !user.passwordHash) {
        user.passwordHash = await hashPassword(user.id);
        user.forcePasswordChange = true;
    }
    try {
        await setDoc(doc(db, COLL_USERS, user.id), user);
    } catch (e: any) {
        console.error("Add user error:", e.message);
    }
};

export const updateUserInCloud = async (user: User) => {
    return addUserToCloud(user);
};

export const updateUserCredentials = async (userId: string, email: string, newPasswordHash: string) => {
    if (!db) return { success: false, error: "Base de datos no disponible" };
    try {
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
    if (!db) return;
    try {
        await setDoc(doc(db, COLL_EQUIPMENT, item.id), item);
    } catch (e: any) {
        console.error("Add equipment error:", e.message);
    }
};

export const updateEquipmentImageInCloud = async (id: string, url: string) => {
    if (!db) return;
    try {
        await setDoc(doc(db, COLL_EQUIPMENT, id), { imageUrl: url }, { merge: true });
    } catch (e: any) {
        console.error("Update image error:", e.message);
    }
};

export const updateEquipmentInCloud = async (updatedItem: Equipment) => {
    if (!db) return { success: false, error: "Base de datos no disponible" };
    try {
        await updateDoc(doc(db, COLL_EQUIPMENT, updatedItem.id), { ...updatedItem });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
};

export const deleteEquipmentInCloud = async (itemId: string) => {
    if (!db) return { success: false, error: "Base de datos no disponible" };
    try {
        await deleteDoc(doc(db, COLL_EQUIPMENT, itemId));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
};

export const initializeCloudDatabase = async () => {
    if (!db) return false;
    try {
        const equipmentSnapshot = await getDocs(query(collection(db, COLL_EQUIPMENT), limit(1)));
        return !equipmentSnapshot.empty;
    } catch (e) {
        return false;
    }
};

export const seedCloudDatabase = async (onProgress?: (message: string, percentage: number) => void) => {
    if (!db) return { success: false, message: "No hay conexión a la base de datos." };

    try {
        const allOperations: { type: 'set', ref: any, data: any }[] = [];

        // 1. Equipos (Usamos DEFAULT_EQUIPMENT como base si no hay nada en la nube)
        DEFAULT_EQUIPMENT.forEach(eq => {
            allOperations.push({
                type: 'set',
                ref: doc(db!, COLL_EQUIPMENT, eq.id),
                data: eq
            });
        });

        // 2. Usuarios
        for (const u of INITIAL_USERS) {
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

        return { success: true, message: `Semilla plantada exitosamente.` };

    } catch (error: any) {
        return { success: false, message: `Error crítico: ${error.message || String(error)}` };
    }
};

