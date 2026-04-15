import { useState, useEffect } from 'react';
import { auth } from './firebase';
import {
    onAuthStateChanged,
    type User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from 'firebase/auth';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const loginByCampus = async (campusId: string) => {
        const email = `${campusId}@campus.local`;
        const secret = import.meta.env.VITE_CAMPUS_SECRET || 'fallback-dev-only';
        const pass = `${campusId}::${secret}`;

        try {
            return await signInWithEmailAndPassword(auth, email, pass);
        } catch (err: any) {
            console.log("Login error code:", err.code);
            // アカウントが存在しない、またはクレデンシャルが無効（新規）な場合は自動作成
            if (
                err.code === 'auth/user-not-found' ||
                err.code === 'auth/invalid-credential' ||
                err.code === 'auth/wrong-password' ||
                err.code === 'auth/invalid-email'
            ) {
                try {
                    return await createUserWithEmailAndPassword(auth, email, pass);
                } catch (signupErr: any) {
                    console.error("Signup error after login fail:", signupErr);
                    throw signupErr;
                }
            }
            throw err;
        }
    };

    const logout = async () => {
        return signOut(auth);
    };

    return {
        user,
        loading,
        loginByCampus,
        logout
    };
};
