import React, { createContext, useContext, useEffect, useState } from 'react';
import { Equipment, LoanRecord, User } from '../types';
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

interface DataContextType {
    equipment: Equipment[];
    loans: LoanRecord[];
    users: User[]; // All users (for admin view)
    isOnline: boolean;
    lastSync: Date | null;
    refreshConnection: () => void;

    // Actions
    addEquipment: (item: Equipment) => Promise<void>;
    updateEquipment: (item: Equipment) => Promise<{ success: boolean; error?: string }>;
    deleteEquipment: (id: string) => Promise<{ success: boolean; error?: string }>;
    updateEquipmentImage: (id: string, url: string) => Promise<void>;

    registerLoan: (loan: LoanRecord) => Promise<{ success: boolean; error?: string }>;
    registerReturn: (loanId: string, equipmentId: string, data: { concept: string, status: string, photos: string[], analysis: string }) => Promise<{ success: boolean; error?: string }>;

    addUser: (user: User) => Promise<void>; // Ideally this also handles Auth creation if needed, but for now just DB
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loans, setLoans] = useState<LoanRecord[]>([]);
    const [users, setUsers] = useState<User[]>([]);
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

    // Data Subscriptions
    useEffect(() => {
        // Only verify subscriptions if we are online or offline-init logic handles it.
        // subscribeToCollection handles offline fallback internally.

        const unsubEq = subscribeToCollection('equipment', (data) => {
            setEquipment(data as Equipment[]);
            setLastSync(new Date());
        });

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
            unsubEq();
            unsubLoans();
            unsubUsers();
        };
    }, []);

    // Actions Wrappers
    const addEquipment = async (item: Equipment) => {
        await addEquipmentToCloud(item);
    };

    const updateEquipment = async (item: Equipment) => {
        return await updateEquipmentInCloud(item);
    };

    const deleteEquipment = async (id: string) => {
        return await deleteEquipmentInCloud(id);
    };

    const updateEquipmentImage = async (id: string, url: string) => {
        await updateEquipmentImageInCloud(id, url);
    };

    const registerLoan = async (loan: LoanRecord) => {
        return await registerNewLoanInCloud(loan);
    };

    const registerReturn = async (loanId: string, equipmentId: string, data: { concept: string, status: string, photos: string[], analysis: string }) => {
        return await registerReturnInCloud(loanId, equipmentId, data);
    };

    const addUser = async (user: User) => {
        await addUserToCloud(user);
    };

    const value = {
        equipment,
        loans,
        users,
        isOnline,
        lastSync,
        refreshConnection,
        addEquipment,
        updateEquipment,
        deleteEquipment,
        updateEquipmentImage,
        registerLoan,
        registerReturn,
        addUser
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
