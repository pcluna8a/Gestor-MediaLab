import React, { createContext, useContext, useEffect, useState } from 'react';
import { Equipment, LoanRecord, User, SystemSettings } from '../types';
import {
    subscribeToCollection,
    addEquipmentToCloud,
    updateEquipmentInCloud,
    deleteEquipmentInCloud,
    registerNewLoanInCloud,
    registerReturnInCloud,
    addUserToCloud,
    updateEquipmentImageInCloud
} from '../services/firebaseService';
import { useAuth } from './AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface DataContextType {
    equipment: Equipment[];
    loans: LoanRecord[];
    users: User[]; // All users (for admin view)
    isOnline: boolean;
    lastSync: Date | null;
    systemSettings: SystemSettings | null;
    refreshConnection: () => void;

    // Actions
    addEquipment: (item: Equipment) => Promise<void>;
    updateEquipment: (item: Equipment) => Promise<{ success: boolean; error?: string }>;
    deleteEquipment: (id: string) => Promise<{ success: boolean; error?: string }>;
    updateEquipmentImage: (id: string, url: string) => Promise<void>;

    registerLoan: (loan: LoanRecord) => Promise<{ success: boolean; error?: string }>;
    registerReturn: (loanId: string, equipmentId: string, data: { concept: string, status: string, photos: string[], analysis: string }) => Promise<{ success: boolean; error?: string }>;

    addUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loans, setLoans] = useState<LoanRecord[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    // Network Status
    const refreshConnection = () => {
        setIsOnline(navigator.onLine);
    };

    useEffect(() => {
        refreshConnection();
        const handleOnline = () => { setIsOnline(true); refreshConnection(); };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Global Settings Subscription
    useEffect(() => {
        if (!db) return;
        const unsubSettings = onSnapshot(doc(db, 'system_settings', 'global'), (docSnap) => {
            if (docSnap.exists()) {
                setSystemSettings(docSnap.data() as SystemSettings);
            }
        });
        return () => unsubSettings();
    }, []);

    // Data Subscriptions
    useEffect(() => {
        // Equipment is public (read: if true), so it can load immediately
        const unsubEq = subscribeToCollection('equipment', (data) => {
            setEquipment(data as Equipment[]);
            setLastSync(new Date());
        });

        return () => {
            unsubEq();
        };
    }, []);

    // Authenticated Subscriptions
    useEffect(() => {
        // Only verify subscriptions if we are logged in
        if (!currentUser) {
            setLoans([]);
            setUsers([]);
            return;
        }

        const unsubLoans = subscribeToCollection('loans', (data) => {
            // Parse dates if they come as strings
            const parsedLoans = data.map(l => ({
                ...l,
                loanDate: l.loanDate instanceof Date ? l.loanDate : new Date(l.loanDate),
                returnDate: l.returnDate ? (l.returnDate instanceof Date ? l.returnDate : new Date(l.returnDate)) : null
            }));
            setLoans(parsedLoans as LoanRecord[]);
            setLastSync(new Date());
        });

        const unsubUsers = subscribeToCollection('users', (data) => {
            setUsers(data as User[]);
        });

        return () => {
            unsubLoans();
            unsubUsers();
        };
    }, [currentUser]);

    // Actions Wrappers
    const addEquipment = async (item: Equipment) => {
        await addEquipmentToCloud(item);
    };

    const updateEquipment = async (item: Equipment) => {
        return await updateEquipmentInCloud(item);
    };

    const deleteEquipment = async (id: string) => {
        if (currentUser?.isSuperAdmin || currentUser?.category === 'SUPER-ADMIN') {
            return await deleteEquipmentInCloud(id, currentUser.id, currentUser.name);
        }
        return await deleteEquipmentInCloud(id);
    };

    const updateEquipmentImage = async (id: string, url: string) => {
        await updateEquipmentImageInCloud(id, url);
    };

    const registerLoan = async (loan: LoanRecord) => {
        if (systemSettings?.maintenanceMode && !currentUser?.isSuperAdmin && currentUser?.category !== 'SUPER-ADMIN') {
            return { success: false, error: "El sistema de préstamos está temporalmente deshabilitado." };
        }
        return await registerNewLoanInCloud(loan);
    };

    const registerReturn = async (loanId: string, equipmentId: string, data: { concept: string, status: string, photos: string[], analysis: string }) => {
        return await registerReturnInCloud(loanId, equipmentId, data);
    };

    const addUser = async (user: User) => {
        await addUserToCloud(user);
    };

    const deleteUser = async (userId: string) => {
        if (!currentUser?.isSuperAdmin && currentUser?.category !== 'SUPER-ADMIN') {
            return { success: false, error: "No tienes permisos para eliminar usuarios." };
        }
        // Assuming deleteUserInCloud is imported from firebaseService
        const { deleteUserInCloud } = await import('../services/firebaseService');
        return await deleteUserInCloud(userId, currentUser.id, currentUser.name);
    };

    const value = {
        equipment,
        loans,
        users,
        isOnline,
        lastSync,
        systemSettings,
        refreshConnection,
        addEquipment,
        updateEquipment,
        deleteEquipment,
        updateEquipmentImage,
        registerLoan,
        registerReturn,
        addUser,
        deleteUser
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
