
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
import { Equipment, LoanRecord, User, EquipmentStatus, Role, UserCategory, AuditLog, SystemSettings, isValidUserFullName, isValidUserEmail } from '../types';
import { DEFAULT_EQUIPMENT, DEFAULT_APRENDICES } from './initialData';

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

// --- VALIDACIÓN ANTI-DUPLICIDAD DE USUARIOS ---
export interface DuplicateCheckResult {
    isDuplicate: boolean;
    conflicts: string[];
}

export const checkDuplicateUser = async (
    id: string,
    email?: string,
    emailGoogle?: string,
    name?: string,
): Promise<DuplicateCheckResult> => {
    if (!db) return { isDuplicate: false, conflicts: [] };

    const conflicts: string[] = [];

    try {
        // 1. Check by Document ID (primary key)
        const docSnap = await getDoc(doc(db, COLL_USERS, id));
        if (docSnap.exists()) {
            conflicts.push(`El documento de identidad "${id}" ya está registrado en el sistema.`);
        }

        // 2. Check by institutional email
        if (email) {
            const emailQuery = query(
                collection(db, COLL_USERS),
                where('email', '==', email)
            );
            const emailSnap = await getDocs(emailQuery);
            if (!emailSnap.empty) {
                const existingId = emailSnap.docs[0].id;
                if (existingId !== id) {
                    conflicts.push(`El correo institucional "${email}" ya está asociado al usuario con ID: ${existingId}.`);
                }
            }
        }

        // 3. Check by Google email
        if (emailGoogle) {
            const googleQuery = query(
                collection(db, COLL_USERS),
                where('emailGoogle', '==', emailGoogle)
            );
            const googleSnap = await getDocs(googleQuery);
            if (!googleSnap.empty) {
                const existingId = googleSnap.docs[0].id;
                if (existingId !== id) {
                    conflicts.push(`El correo Google "${emailGoogle}" ya está asociado al usuario con ID: ${existingId}.`);
                }
            }
        }

        // 4. Check by exact name match
        if (name && name !== 'Usuario Registrado' && name !== 'Usuario') {
            const nameQuery = query(
                collection(db, COLL_USERS),
                where('name', '==', name)
            );
            const nameSnap = await getDocs(nameQuery);
            if (!nameSnap.empty) {
                const existingId = nameSnap.docs[0].id;
                if (existingId !== id) {
                    conflicts.push(`El nombre "${name}" ya está registrado bajo el ID: ${existingId}. Si eres la misma persona, usa el mismo ID.`);
                }
            }
        }

        return { isDuplicate: conflicts.length > 0, conflicts };
    } catch (error: any) {
        console.error("Duplicate check error:", error);
        return { isDuplicate: false, conflicts: [] }; // Fail open to not block access
    }
};

/**
 * Verifica si un ID corresponde a un equipo del inventario de MediaLab
 */
export const checkIsEquipmentId = async (id: string): Promise<{ isEquipment: boolean; equipmentName?: string }> => {
    if (!db || !id) return { isEquipment: false };
    try {
        const cleanId = id.trim();
        const eqRef = doc(db, COLL_EQUIPMENT, cleanId);
        const eqSnap = await getDoc(eqRef);
        if (eqSnap.exists()) {
            const eqData = eqSnap.data() as Equipment;
            return {
                isEquipment: true,
                equipmentName: eqData.name || eqData.description || 'Equipo de Inventario'
            };
        }
        return { isEquipment: false };
    } catch (e) {
        console.warn("Error checking equipment ID:", e);
        return { isEquipment: false };
    }
};

/**
 * Consulta si un usuario ya existe en Firestore por su ID de documento
 */
export const checkExistingUserById = async (id: string): Promise<{ exists: boolean; user?: User }> => {
    if (!db || !id) return { exists: false };
    try {
        const cleanId = id.trim().replace(/[^0-9]/g, '');
        if (!cleanId) return { exists: false };
        const userRef = doc(db, COLL_USERS, cleanId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return { exists: true, user: userSnap.data() as User };
        }
        return { exists: false };
    } catch (e) {
        return { exists: false };
    }
};

export const completeUserProfile = async (
    id: string,
    uid: string,
    category: string,
    email?: string,
    emailGoogle?: string,
    name?: string
) => {
    if (!db) return { success: false, error: "Servicios no inicializados" };

    const cleanId = id.trim().replace(/[^0-9]/g, '');
    if (!cleanId || cleanId.length < 5) {
        return { success: false, error: "El documento de identidad debe contener al menos 5 dígitos numéricos." };
    }

    // 1. REGLA CRÍTICA: Un usuario NUNCA puede registrarse con el ID de un equipo del inventario
    const eqCheck = await checkIsEquipmentId(cleanId);
    if (eqCheck.isEquipment) {
        return {
            success: false,
            error: `⚠️ El documento ingresado (${cleanId}) pertenece al equipo "${eqCheck.equipmentName}" del inventario. Debes ingresar tu documento de identidad personal.`
        };
    }

    // 2. REGLA CRÍTICA: Nombre y Apellido obligatorios y válidos (mínimo dos palabras)
    const trimmedName = (name || '').trim();
    if (!isValidUserFullName(trimmedName)) {
        return {
            success: false,
            error: "Debes ingresar tu Nombre y Apellido completos (mínimo dos palabras). No se permiten registros sin apellidos o genéricos."
        };
    }

    // 3. REGLA CRÍTICA: Correo electrónico obligatorio
    const effectiveEmail = (email || emailGoogle || '').trim();
    if (!isValidUserEmail(effectiveEmail)) {
        return {
            success: false,
            error: "Debes ingresar un correo electrónico válido para completar tu registro."
        };
    }

    try {
        const userRef = doc(db, COLL_USERS, cleanId);

        // --- Anti-Duplicity Check (before creating new users) ---
        const existingSnap = await getDoc(userRef);
        if (!existingSnap.exists()) {
            // Only run full duplicate check when creating a NEW user
            const duplicateCheck = await checkDuplicateUser(cleanId, effectiveEmail, emailGoogle, trimmedName);
            if (duplicateCheck.isDuplicate) {
                return {
                    success: false,
                    error: `⚠️ Registro duplicado detectado:\n${duplicateCheck.conflicts.join('\n')}`
                };
            }
        }

        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);

            if (userSnap.exists()) {
                // User exists, merge data and fix any previous incomplete/generic name
                const userData = userSnap.data() as User;
                const updates: any = {};

                if (trimmedName && (!isValidUserFullName(userData.name) || userData.name !== trimmedName)) {
                    updates.name = trimmedName;
                }

                if (uid && !userData.uid) updates.uid = uid;
                if (effectiveEmail && (!userData.email || !isValidUserEmail(userData.email))) updates.email = effectiveEmail;
                if (emailGoogle && !userData.emailGoogle) updates.emailGoogle = emailGoogle;
                if (category && userData.category !== category) {
                    updates.category = category;
                    if (category === UserCategory.SUPER_ADMIN || category === UserCategory.ADMIN) {
                        updates.role = Role.INSTRUCTOR_MEDIALAB;
                    }
                    if (category === UserCategory.SUPER_ADMIN) {
                        updates.isSuperAdmin = true;
                    }
                }

                if (Object.keys(updates).length > 0) {
                    transaction.update(userRef, updates);
                }
            } else {
                // User does not exist, create new unified record with full valid data
                const isInstructorCategory = category === UserCategory.SUPER_ADMIN || category === UserCategory.ADMIN;
                const newUser: User = {
                    id: cleanId,
                    uid,
                    name: trimmedName,
                    role: isInstructorCategory ? Role.INSTRUCTOR_MEDIALAB : Role.USUARIO_MEDIALAB,
                    category: category as any,
                };
                if (category === UserCategory.SUPER_ADMIN) newUser.isSuperAdmin = true;
                if (effectiveEmail) newUser.email = effectiveEmail;
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
                // Always merge the Firestore document ID into the data object.
                // doc.data() does NOT include the document ID by default, which causes
                // user.id, equipment.id, etc. to be undefined if not explicitly stored as a field.
                const docData = doc.data();
                data.push({ id: doc.id, ...docData });
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
            const borrowerId = (loan.borrowerId || '').trim();
            const equipmentId = (loan.equipmentId || '').trim();

            // 1. Inconsistencia crítica: El prestatario NO puede ser el mismo equipo
            if (borrowerId === equipmentId) {
                throw new Error('Inconsistencia: El ID del prestatario no puede ser igual al ID del equipo a prestar.');
            }

            // 2. Verificar que el prestatario NO sea un equipo del inventario
            const borrowerAsEqRef = doc(db!, COLL_EQUIPMENT, borrowerId);
            const borrowerAsEqSnap = await transaction.get(borrowerAsEqRef);
            if (borrowerAsEqSnap.exists()) {
                const eqData = borrowerAsEqSnap.data() as Equipment;
                throw new Error(`El ID "${borrowerId}" ingresado como prestatario corresponde al equipo "${eqData.name || 'Equipo'}" del inventario y no a una persona.`);
            }

            // 3. Verificar que el equipo exista y esté disponible
            const equipmentRef = doc(db!, COLL_EQUIPMENT, equipmentId);
            const equipmentSnap = await transaction.get(equipmentRef);
            if (!equipmentSnap.exists()) {
                throw new Error('El equipo no existe en el inventario.');
            }
            const equipmentData = equipmentSnap.data() as Equipment;
            if (equipmentData.status === EquipmentStatus.ON_LOAN) {
                throw new Error('Este equipo ya se encuentra prestado. Debe ser devuelto antes de generar un nuevo préstamo.');
            }

            // 4. Verificar que el usuario prestatario aparezca previamente registrado en la base de datos
            const borrowerRef = doc(db!, COLL_USERS, borrowerId);
            const borrowerSnap = await transaction.get(borrowerRef);
            if (!borrowerSnap.exists()) {
                throw new Error(`El usuario con ID "${borrowerId}" no aparece registrado previamente en la base de datos. Debe completar su registro de usuario antes de acceder al préstamo.`);
            }

            // 5. Verificar que el prestatario tenga Nombre y Apellido válidos (no genéricos como "Usuario Registrado")
            const borrower = borrowerSnap.data() as User;
            if (!isValidUserFullName(borrower.name)) {
                throw new Error(`El usuario prestatario (ID: ${borrowerId}) no tiene registrado su Nombre y Apellido completos (figura como "${borrower.name || 'Sin nombre'}"). Debe completar su registro antes de proceder con el préstamo.`);
            }

            // 6. Verificar que el prestatario tenga un correo electrónico registrado
            const borrowerEmail = borrower.email || borrower.emailGoogle;
            if (!isValidUserEmail(borrowerEmail)) {
                throw new Error(`El usuario prestatario (ID: ${borrowerId}) no tiene un correo electrónico válido registrado. Debe completar su registro antes de proceder con el préstamo.`);
            }

            const loanRef = doc(db!, COLL_LOANS, loan.id);
            const loanData = {
                ...loan,
                borrowerId,
                equipmentId,
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
    returnData: { concept: string, status: string, photos: string[], analysis: string, returnedByInstructorId?: string }
) => {
    if (!db) return { success: false, error: "Base de datos no disponible" };

    try {
        await runTransaction(db, async (transaction) => {
            const equipmentRef = doc(db!, COLL_EQUIPMENT, equipmentId);
            const loanRef = doc(db!, COLL_LOANS, loanId);

            const updatePayload: any = {
                returnDate: new Date().toISOString(),
                returnConcept: returnData.concept,
                returnStatus: returnData.status,
                returnPhotos: returnData.photos,
                returnConditionAnalysis: returnData.analysis
            };

            if (returnData.returnedByInstructorId) {
                updatePayload.returnedByInstructorId = returnData.returnedByInstructorId;
            }

            transaction.update(loanRef, updatePayload);
            transaction.update(equipmentRef, { status: EquipmentStatus.AVAILABLE });
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
};

export const addUserToCloud = async (user: User): Promise<{ success: boolean; error?: string }> => {
    if (!db) return { success: false, error: "Base de datos no disponible" };

    const cleanId = (user.id || '').trim().replace(/[^0-9]/g, '');
    if (!cleanId || cleanId.length < 5) {
        return { success: false, error: "El documento debe contener al menos 5 dígitos numéricos." };
    }

    // Comprobar que no coincida con un equipo de inventario
    const eqCheck = await checkIsEquipmentId(cleanId);
    if (eqCheck.isEquipment) {
        return {
            success: false,
            error: `El ID ${cleanId} coincide con el equipo "${eqCheck.equipmentName}" del inventario. No se puede crear un usuario con este documento.`
        };
    }

    if (!isValidUserFullName(user.name)) {
        return {
            success: false,
            error: "El usuario debe tener un Nombre y Apellido completos (mínimo dos palabras). No se permiten registros genéricos."
        };
    }

    const email = user.email || user.emailGoogle;
    if (email && !isValidUserEmail(email)) {
        return {
            success: false,
            error: "El correo electrónico ingresado no es válido."
        };
    }

    if (user.role === Role.INSTRUCTOR_MEDIALAB && !user.passwordHash) {
        const { hash, salt } = await hashPassword(cleanId);
        user.passwordHash = hash;
        (user as any).passwordSalt = salt;
        user.forcePasswordChange = true;
    }

    try {
        await setDoc(doc(db, COLL_USERS, cleanId), { ...user, id: cleanId, name: user.name.trim() }, { merge: true });
        return { success: true };
    } catch (e: any) {
        console.error("Add user error:", e.message);
        return { success: false, error: e.message || String(e) };
    }
};

/**
 * Limpia el usuario anómalo con ID de equipo (ej. 95271024891) si fue creado por error en users
 */
export const cleanupEquipmentUserCollisions = async (): Promise<{ cleanedCount: number }> => {
    if (!db) return { cleanedCount: 0 };
    let cleanedCount = 0;
    try {
        const userRef = doc(db, COLL_USERS, '95271024891');
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data() as User;
            if (!isValidUserFullName(data.name) || data.name === 'Usuario Registrado') {
                await deleteDoc(userRef);
                console.log("Limpiado usuario colisionado con equipo:", '95271024891');
                cleanedCount++;
            }
        }
    } catch (err) {
        console.warn("cleanupEquipmentUserCollisions warning:", err);
    }
    return { cleanedCount };
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

        // Seed default aprendices from initialData
        DEFAULT_APRENDICES.forEach(usr => {
            allOperations.push({
                type: 'set',
                ref: doc(db!, COLL_USERS, usr.id),
                data: usr
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

export const syncAprendicesToCloud = async () => {
    if (!db) return { success: false, count: 0 };
    try {
        const batch = writeBatch(db);
        DEFAULT_APRENDICES.forEach(user => {
            batch.set(doc(db!, COLL_USERS, user.id), user, { merge: true });
        });
        await batch.commit();
        return { success: true, count: DEFAULT_APRENDICES.length };
    } catch (e: any) {
        console.error("Error sincronizando aprendices:", e);
        return { success: false, count: 0, error: e.message };
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
