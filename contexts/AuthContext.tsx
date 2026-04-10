import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Role, UserCategory } from '../types';
import { auth, db } from '../firebaseConfig';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, getDocs, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { loginInstructor, loginStudent, logoutUser, loginWithGoogle as loginWithGoogleService, sendPasswordReset as sendResetService, completeUserProfile } from '../services/firebaseService';

interface AuthContextType {
    currentUser: User | null;
    pendingProfileUser: FirebaseUser | null;
    isLoading: boolean;
    loginInstructor: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    loginStudent: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
    sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
    completeProfile: (id: string, category: UserCategory) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    isAdmin: boolean;
    isInstructor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to find user profile by Auth data
const fetchUserProfile = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
        // Primary lookup: by Firebase Auth UID (fastest, indexed)
        const qUid = query(collection(db, 'users'), where('uid', '==', firebaseUser.uid), limit(1));
        const uidSnapshot = await getDocs(qUid);
        if (!uidSnapshot.empty) {
            // Merge doc.id to guarantee user.id is always populated
            return { id: uidSnapshot.docs[0].id, ...uidSnapshot.docs[0].data() } as User;
        }

        // --- FALLBACK for manually-registered instructors ---
        // These admins were created via ManageUsersView and may not have a uid field yet.
        // We look them up by their institutional email and then bind the uid automatically.
        if (firebaseUser.email) {
            const qEmail = query(collection(db, 'users'), where('email', '==', firebaseUser.email), limit(1));
            const emailSnapshot = await getDocs(qEmail);
            if (!emailSnapshot.empty) {
                const userDocRef = emailSnapshot.docs[0].ref;
                const userData = emailSnapshot.docs[0].data() as User;

                // Auto-bind the Firebase Auth uid to the Firestore document
                // so that subsequent logins are resolved instantly via the primary lookup.
                if (!userData.uid) {
                    try {
                        await updateDoc(userDocRef, { uid: firebaseUser.uid });
                    } catch (bindError) {
                        console.warn("Could not bind uid to user document:", bindError);
                    }
                }

                return { id: emailSnapshot.docs[0].id, ...userData, uid: firebaseUser.uid };
            }
        }

        // Also try searching by googleEmail for Google-authenticated users
        if (firebaseUser.email) {
            const qGEmail = query(collection(db, 'users'), where('emailGoogle', '==', firebaseUser.email), limit(1));
            const gEmailSnapshot = await getDocs(qGEmail);
            if (!gEmailSnapshot.empty) {
                const userDocRef = gEmailSnapshot.docs[0].ref;
                const userData = gEmailSnapshot.docs[0].data() as User;
                if (!userData.uid) {
                    try {
                        await updateDoc(userDocRef, { uid: firebaseUser.uid });
                    } catch (bindError) {
                        console.warn("Could not bind uid to user document:", bindError);
                    }
                }
                return { id: gEmailSnapshot.docs[0].id, ...userData, uid: firebaseUser.uid };
            }
        }

        return null; // No Firestore profile found — needs profile completion
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [pendingProfileUser, setPendingProfileUser] = useState<FirebaseUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userProfile = await fetchUserProfile(firebaseUser);
                if (userProfile) {
                    setCurrentUser(userProfile);
                    setPendingProfileUser(null);
                } else {
                    setCurrentUser(null);
                    setPendingProfileUser(firebaseUser); // Profile missing Document ID
                }
            } else {
                setCurrentUser(null);
                setPendingProfileUser(null);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const processLoginResult = async (res: any) => {
        if (res.success && res.user) {
            const userProfile = await fetchUserProfile(res.user as FirebaseUser);
            if (userProfile) {
                setCurrentUser(userProfile);
                setPendingProfileUser(null);
            } else {
                setCurrentUser(null);
                setPendingProfileUser(res.user as FirebaseUser);
            }
            return { success: true };
        }
        return { success: false, error: res.error };
    };

    // Handlers
    const handleLoginInstructor = async (email: string, password: string) => {
        const res = await loginInstructor(email, password);
        return processLoginResult(res);
    };

    const handleLoginStudent = async (email: string, password: string) => {
        const res = await loginStudent(email, password);
        return processLoginResult(res);
    };

    const handleLoginGoogle = async () => {
        const res = await loginWithGoogleService();
        return processLoginResult(res);
    };

    const handleCompleteProfile = async (id: string, category: UserCategory) => {
        if (!pendingProfileUser) return { success: false, error: "No hay cuenta pendiente vinculada." };

        const isGoogleProvider = pendingProfileUser.providerData.some(p => p.providerId === 'google.com');
        const email = isGoogleProvider ? undefined : pendingProfileUser.email || undefined;
        const emailGoogle = isGoogleProvider ? pendingProfileUser.email || undefined : undefined;
        const name = pendingProfileUser.displayName || 'Usuario Registrado';

        const res = await completeUserProfile(id, pendingProfileUser.uid, category, email, emailGoogle, name);
        if (res.success && res.user) {
            setCurrentUser(res.user);
            setPendingProfileUser(null);
            return { success: true };
        }
        return { success: false, error: res.error };
    };

    const handleResetPassword = async (email: string) => {
        return await sendResetService(email);
    };

    const logout = async () => {
        await logoutUser();
        setCurrentUser(null);
        setPendingProfileUser(null);
    };

    const value = {
        currentUser,
        pendingProfileUser,
        isLoading,
        loginInstructor: handleLoginInstructor,
        loginStudent: handleLoginStudent,
        loginWithGoogle: handleLoginGoogle,
        sendPasswordReset: handleResetPassword,
        completeProfile: handleCompleteProfile,
        logout,
        isAdmin: currentUser?.isSuperAdmin === true,
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
