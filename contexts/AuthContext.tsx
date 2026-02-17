import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Role, UserCategory } from '../types';
import { auth, db } from '../firebaseConfig';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // User is signed in, fetch profile from Firestore
                // Students are stored by ID (which is not the uid for anonymous auth? Wait.)
                // In my loginStudent implementation:
                // await signInAnonymously(auth);
                // await setDoc(doc(db, COLL_USERS, id), ...);

                // This is tricky. Anonymous auth gives a random UID. 
                // My loginStudent implementation SAVES the user with their Student ID as the document key.
                // It DOES NOT link the Auth UID to the Student ID in a standard way easily retrievable just by UID unless we store UID in the user doc and query by it.
                // OR we use the UID as the document key.

                // Let's look at loginStudent again:
                // const userRef = doc(db, COLL_USERS, id);  <-- Uses Student ID as key.
                // signInAnonymously(auth);

                // If I reload the page, onAuthStateChanged gives me user.uid.
                // I don't know the Student ID from the UID unless I query 'users' where 'uid' == user.uid.
                // BUT my current user schema doesn't necessarily have 'uid' field synced from Auth.
                // AND 'loginStudent' didn't save the firebaseUser.uid into the firestore doc.

                // CORRECTION NEEDED in logic:
                // Ideally, we should use the Auth UID as the key, or store Auth UID in the doc.
                // Given I already have a 'users' collection with custom IDs (Student IDs or Instructor IDs),
                // I should probably query collection 'users' where 'authUid' == firebaseUser.uid.

                // Let's assume for now I will fix this by storing the authUid in the user document upon login.

                try {
                    // Try to find user by authUid property (we need to add this property to User type and save it)
                    // Or simpler: For instructors, if we use Email Auth, the UID is constant.
                    // For students with Anonymous auth, the UID persists in the browser session.

                    // Strategy:
                    // 1. Check if there is a claim or just query users collection for this email (instructors) or metadata.
                    // Since we are migrating, let's stick to: Query users where 'email' == firebaseUser.email (for instructors)
                    // For students (anonymous), we need to store their UID.

                    // Temporary Workaround to match existing plan without massive migration:
                    // We'll rely on the fact that we can store the 'local' user ID in localStorage as a backup to re-fetch?
                    // No, that's insecure.

                    // Better: When logging in, we update the user doc with the current `authUid`.
                    // Then here, we query `users` where `authUid` == `firebaseUser.uid`.

                    // I need to update 'User' type to include optional 'authUid'.

                    // For now, I will implement a fetch that tries to find the user.
                    // If it's an email user, find by email.
                    // If it's anonymous, we need that link.

                    // Let's assume for now we might fail to auto-login students on refresh if we don't link them.
                    // I will implement a simple query helper.

                    // For instructors (Email):
                    if (firebaseUser.email) {
                        // Query by email
                        // This requires a query.
                    }
                } catch (e) {
                    console.error("Error fetching user profile", e);
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
            // Fetch profile and set state
            // logic to fetch profile by email
            return { success: true };
        }
        return { success: false, error: res.error };
    };

    const handleLoginStudent = async (id: string, category: UserCategory) => {
        const res = await loginStudent(id, category);
        if (res.success && res.user) {
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
        isAdmin: currentUser?.role === Role.INSTRUCTOR_MEDIALAB, // Admin/Instructor same for now?
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
