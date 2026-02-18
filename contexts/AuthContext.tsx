import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Role, UserCategory } from '../types';
import { auth, db } from '../firebaseConfig';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { loginInstructor, loginStudent, logoutUser } from '../services/firebaseService';

interface AuthContextType {
    currentUser: User | null;
    isLoading: boolean;
    loginInstructor: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    loginStudent: (id: string, category: UserCategory) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    isAdmin: boolean;
    isInstructor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to find user profile by Auth data
const fetchUserProfile = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
        // 1. If Instructors (Email Auth)
        if (firebaseUser.email) {
            // Query users collection by email
            const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email), limit(1));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                return querySnapshot.docs[0].data() as User;
            }
        }

        // 2. If Students (Anonymous Auth) OR if Email lookup failed but we have a UID link
        // Search by 'uid' field which we now save on loginStudent
        const qUid = query(collection(db, 'users'), where('uid', '==', firebaseUser.uid), limit(1));
        const uidSnapshot = await getDocs(qUid);
        if (!uidSnapshot.empty) {
            return uidSnapshot.docs[0].data() as User;
        }

        return null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userProfile = await fetchUserProfile(firebaseUser);
                if (userProfile) {
                    setCurrentUser(userProfile);
                } else {
                    console.warn("User authenticated but no profile found in Firestore.");
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Handlers
    const handleLoginInstructor = async (email: string, password: string) => {
        const res = await loginInstructor(email, password);
        if (res.success && res.user) {
            const userProfile = await fetchUserProfile(res.user as FirebaseUser);
            if (userProfile) {
                setCurrentUser(userProfile);
                return { success: true };
            } else {
                return { success: false, error: "Usuario no encontrado en base de datos." };
            }
        }
        return { success: false, error: res.error };
    };

    const handleLoginStudent = async (id: string, category: UserCategory) => {
        const res = await loginStudent(id, category);
        if (res.success && res.user) {
            // Check if we need to update the currentUser state manually
            // With the new logic, onAuthStateChanged might handle it, but setting it here is faster/safer response
            // The loginStudent service returns the Firestore User object, so we can just set it.
            setCurrentUser(res.user);
            return { success: true };
        }
        return { success: false, error: res.error };
    };

    const logout = async () => {
        await logoutUser();
        setCurrentUser(null);
    };

    const value = {
        currentUser,
        isLoading,
        loginInstructor: handleLoginInstructor,
        loginStudent: handleLoginStudent,
        logout,
        isAdmin: currentUser?.role === Role.INSTRUCTOR_MEDIALAB,
        isInstructor: currentUser?.role === Role.INSTRUCTOR_MEDIALAB
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
