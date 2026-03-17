
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
    where,
    getDoc
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { Equipment, LoanRecord, User, EquipmentStatus, Role, UserCategory, AuditLog, SystemSettings } from '../types';
import { DEFAULT_EQUIPMENT } from './initialData';

// --- CONSTANTES ---
const COLL_EQUIPMENT = 'equipment';
const COLL_LOANS = 'loans';
const COLL_USERS = 'users';

// --- ESTADO DE CONEXIÓN ---
// Firestore maneja internamente la persistencia y el modo offline.

// --- SEGURIDAD (HASHING) ---
export const hashPassword = async (password: string, salt?: string): Promise<{ hash: string, salt: string }> => {
    const useSalt = salt || Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    const salted = useSalt + password;
    const msgBuffer = new TextEncoder().encode(salted);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return { hash: hashHex, salt: useSalt };
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
export const loginStudent = async (email: string, password: string) => {
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

        // Return only the Firebase User. Firestore document unification 
        // will be handled explicitly via completeUserProfile.
        return { success: true, user: userCredential.user };
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

export const completeUserProfile = async (
    id: string,
    uid: string,
    category: string,
    email?: string,
    emailGoogle?: string,
    name: string = 'Usuario Registrado'
) => {
    if (!db) return { success: false, error: "Servicios no inicializados" };

    try {
        const userRef = doc(db, COLL_USERS, id);

        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);

            if (userSnap.exists()) {
                // User exists, merge data
                const userData = userSnap.data() as User;
                const updates: any = {};

                if (uid && !userData.uid) updates.uid = uid;
                if (email && !userData.email) updates.email = email;
                if (emailGoogle && !userData.emailGoogle) updates.emailGoogle = emailGoogle;
                if (category && userData.category !== category) {
                    updates.category = category;
                    if (category === UserCategory.SUPER_ADMIN) {
                        updates.role = Role.INSTRUCTOR_MEDIALAB;
                        updates.isSuperAdmin = true;
                    }
                }

                if (Object.keys(updates).length > 0) {
                    transaction.update(userRef, updates);
                }
            } else {
                // User does not exist, create new unified record
                const newUser: User = {
                    id,
                    uid,
                    name,
                    role: category === UserCategory.SUPER_ADMIN ? Role.INSTRUCTOR_MEDIALAB : Role.USUARIO_MEDIALAB,
                    category: category as any,
                };
                if (category === UserCategory.SUPER_ADMIN) newUser.isSuperAdmin = true;
                if (email) newUser.email = email;
                if (emailGoogle) newUser.emailGoogle = emailGoogle;

                transaction.set(userRef, newUser);
            }
        });

        // After transaction, get the final document to return it
        const finalSnap = await getDoc(userRef);
        return { success: true, user: finalSnap.data() as User };
    } catch (error: any) {
        console.error("Profile completion error:", error);
        return { success: false, error: error.message || String(error) };
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

            // Check if equipment is already on loan
            const equipmentSnap = await transaction.get(equipmentRef);
            if (!equipmentSnap.exists()) {
                throw new Error('El equipo no existe en el inventario.');
            }
            const equipmentData = equipmentSnap.data();
            if (equipmentData.status === EquipmentStatus.ON_LOAN) {
                throw new Error('Este equipo ya se encuentra prestado. Debe ser devuelto antes de generar un nuevo préstamo.');
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
        const { hash, salt } = await hashPassword(user.id);
        user.passwordHash = hash;
        (user as any).passwordSalt = salt;
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

export const deleteUserInCloud = async (
    userId: string,
    actorId?: string,
    actorName?: string
) => {
    if (!db) return { success: false, error: "Base de datos no disponible" };
    try {
        await deleteDoc(doc(db, COLL_USERS, userId));
        if (actorId && actorName) {
            await logAuditAction('DELETE_USER', actorId, actorName, userId);
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
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

export const deleteEquipmentInCloud = async (
    itemId: string,
    actorId?: string,
    actorName?: string
) => {
    if (!db) return { success: false, error: "Base de datos no disponible" };
    try {
        await deleteDoc(doc(db, COLL_EQUIPMENT, itemId));
        if (actorId && actorName) {
            await logAuditAction('DELETE_EQUIPMENT', actorId, actorName, itemId);
        }
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

        // Seed equipment data from initialData
        DEFAULT_EQUIPMENT.forEach(eq => {
            allOperations.push({
                type: 'set',
                ref: doc(db!, COLL_EQUIPMENT, eq.id),
                data: eq
            });
        });

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


// --- SISTEMA SUPER-ADMIN: AUDITORÍA Y SETTINGS ---

export const logAuditAction = async (action: string, actorId: string, actorName: string, targetId: string, metadata?: any) => {
    if (!db) return;
    try {
        const logData: AuditLog = {
            id: `AL_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            action,
            actorId,
            actorName,
            targetId,
            timestamp: new Date().toISOString(),
            metadata: metadata || {}
        };
        await setDoc(doc(db, 'audit_logs', logData.id), logData);
    } catch (e: any) {
        console.error("Failed to log audit action:", e.message);
    }
};

export const updateSystemSettings = async (settings: Partial<SystemSettings>) => {
    if (!db) return { success: false, error: "Base de datos no disponible" };
    try {
        await setDoc(doc(db, 'system_settings', 'global'), settings, { merge: true });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: String(e) };
    }
};
