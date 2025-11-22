
import { db } from '../firebaseConfig';
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
  enableNetwork,
  disableNetwork
} from "firebase/firestore";
import { Equipment, LoanRecord, User, EquipmentStatus, Role } from '../types';
import { DEFAULT_EQUIPMENT } from './initialData';
import { INITIAL_USERS } from '../constants';

// --- CONSTANTES ---
const COLL_EQUIPMENT = 'equipment';
const COLL_LOANS = 'loans';
const COLL_USERS = 'users';
const COLL_CONFIG = 'config';
const DOC_APP_CONFIG = 'app_config';

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

// --- FUNCIONES HIBRIDAS ---

export const checkCloudConnection = async (): Promise<boolean> => {
    if (!db) {
        isOfflineMode = true;
        initLocalDataIfNeeded();
        return false;
    }

    try {
        // Ping ligero: Intentamos obtener referencia a la colección, no leer todos los docs
        // Esto valida auth y red sin gastar cuota excesiva
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
        const connectionPromise = getDocs(query(collection(db, 'users'), limit(1))); 
        
        await Promise.race([connectionPromise, timeoutPromise]);
        
        // Si estábamos offline y volvemos, reactivamos red de Firestore explícitamente
        if (isOfflineMode) {
            await enableNetwork(db);
        }

        isOfflineMode = false;
        return true;
    } catch (error: any) {
        console.warn("Cloud Check Failed:", error.code);
        
        // Si falla, intentamos deshabilitar red para que Firestore use caché limpiamente
        // y no se quede "colgado" intentando conectar
        if (!isOfflineMode) {
             isOfflineMode = true;
             try { await disableNetwork(db); } catch(e) {}
             initLocalDataIfNeeded();
        }
        return false;
    }
};

export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
  // 1. Si estamos en modo forzado offline o sin DB, usar local storage
  if (isOfflineMode || !db) {
      const initialData = getLocalData(collectionName);
      callback(initialData);
      
      const listener = (data: any[]) => callback(data);
      localListeners[collectionName].push(listener);
      
      return () => {
          localListeners[collectionName] = localListeners[collectionName].filter(l => l !== listener);
      };
  }

  // 2. Modo Online (Firestore Real-time)
  try {
      const q = query(collection(db, collectionName));
      
      // onSnapshot se encarga de la reconexión automática y consistencia
      const unsubscribe = onSnapshot(q, 
        { includeMetadataChanges: true }, // Importante para saber si viene de caché o servidor
        (querySnapshot) => {
          const data: any[] = [];
          querySnapshot.forEach((doc) => {
            data.push(doc.data());
          });
          
          // Validación básica: Si viene vacío pero sabemos que debería haber datos, 
          // es posible que estemos cargando o sin permisos.
          // Pero si querySnapshot.metadata.fromCache es true, son datos locales temporales.
          
          callback(data);
        },
        (error) => {
          console.error(`Sync Error (${collectionName}):`, error.message);
          
          // Fallback silencioso a local si el socket se rompe
          const localData = getLocalData(collectionName);
          callback(localData);
        }
      );

      return () => {
          unsubscribe();
      };
  } catch (e) {
      console.error("Setup Error:", e);
      const localData = getLocalData(collectionName);
      callback(localData);
      return () => {};
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
    console.error("Return transaction failed:", msg);
    return { success: false, error: msg };
  }
};

export const addUserToCloud = async (user: User) => {
    // Si es Instructor, asegurar hash inicial
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
    await setDoc(doc(db, COLL_USERS, user.id), user);
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
        // Intentamos updateDoc primero
        const userRef = doc(db, COLL_USERS, userId);
        
        // Verificación preventiva o setDoc con merge si no existe
        await setDoc(userRef, {
            email: email,
            passwordHash: newPasswordHash,
            forcePasswordChange: false
        }, { merge: true });

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
    await setDoc(doc(db, COLL_EQUIPMENT, item.id), item);
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
    await setDoc(doc(db, COLL_EQUIPMENT, id), { imageUrl: url }, { merge: true });
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
        await updateDoc(doc(db, COLL_EQUIPMENT, updatedItem.id), { ...updatedItem });
        return { success: true };
    } catch (e: any) {
        const msg = e.message || String(e);
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
        await deleteDoc(doc(db, COLL_EQUIPMENT, itemId));
        return { success: true };
    } catch (e: any) {
        const msg = e.message || String(e);
        console.error("Error deleting equipment:", msg);
        return { success: false, error: msg };
    }
};

export const batchUploadEquipment = async (items: Equipment[], onProgress?: (count: number, total: number) => void) => {
    if (isOfflineMode || !db) {
        const equipment = getLocalData(COLL_EQUIPMENT);
        items.forEach(newItem => {
            const idx = equipment.findIndex(e => e.id === newItem.id);
            if (idx >= 0) equipment[idx] = newItem;
            else equipment.push(newItem);
        });
        setLocalData(COLL_EQUIPMENT, equipment);
        return { success: true, message: `${items.length} items procesados localmente.` };
    }

    try {
        const BATCH_SIZE = 400; // Firestore limit is 500
        const chunks = [];
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            chunks.push(items.slice(i, i + BATCH_SIZE));
        }

        let processed = 0;
        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(item => {
                const ref = doc(db!, COLL_EQUIPMENT, item.id);
                batch.set(ref, item, { merge: true }); // Merge allows updating existing
            });
            await batch.commit();
            processed += chunk.length;
            if (onProgress) onProgress(processed, items.length);
        }
        return { success: true, message: `${processed} equipos importados/actualizados correctamente.` };
    } catch (e: any) {
        console.error("Batch upload error:", e);
        return { success: false, message: `Error: ${e.message}` };
    }
};

export const initializeCloudDatabase = async () => {
    if (isOfflineMode || !db) return false;
    try {
        const equipmentSnapshot = await getDocs(query(collection(db, COLL_EQUIPMENT), limit(1)));
        if (equipmentSnapshot.empty) return false;
        return true;
    } catch (e) {
        console.warn("Error verificando DB:", e);
    }
    return false;
};

export const seedCloudDatabase = async (onProgress?: (message: string, percentage: number) => void) => {
    // VERIFICACIÓN ESTRICTA ANTES DE MIGRAR
    if (isOfflineMode || !db) {
        const errorMsg = "No hay conexión válida a Firebase (Modo Offline). Verifica firebaseConfig.ts";
        console.error(errorMsg);
        return { success: false, message: errorMsg };
    }

    try {
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
        console.error("Error en migración:", msg);
        return { success: false, message: `Error crítico: ${msg}. Verifica permisos o API Key.` };
    }
};

export const uploadLogoToCloud = async (base64Image: string) => {
    if (isOfflineMode || !db) {
        setLocalData('app_logo', [base64Image]);
        return;
    }
    await setDoc(doc(db, COLL_CONFIG, DOC_APP_CONFIG), { logoBase64: base64Image }, { merge: true });
};

export const subscribeToAppConfig = (callback: (config: any) => void) => {
    if (isOfflineMode || !db) {
        const logo = getLocalData('app_logo')[0];
        callback(logo ? { logoBase64: logo } : null);
        return () => {};
    }
    return onSnapshot(doc(db, COLL_CONFIG, DOC_APP_CONFIG), (doc) => {
        callback(doc.data());
    });
};
